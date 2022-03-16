import { BaseNode, RootNode } from "./node";
import {
	BinaryLogicNode,
	BinaryLogicOperator,
	CollectionFilterData,
	CollectionFilterNode,
	CompareNode,
	CompareOperator,
	ConstantDataType,
	ConstantNode,
	LambdaNode,
	NegateLogicNode,
	precedenceMap,
	SearchInNode,
	VariableNode,
} from "./odata-syntax";

export type ItemPredicate = (item: (name?: string) => Builder) => Builder;

export class Builder {
	// Each static method is an entry point for user to start building the query.

	static field(name: string) {
		return new Builder().field(name);
	}

	static not(expression: Builder | boolean) {
		const builder = new Builder();
		return typeof expression === "boolean" ? builder.not(expression) : builder.not(expression.root.content);
	}

	static ifAny(expressions: Builder[]) {
		return new Builder().ifAny(expressions);
	}

	static ifAll(expressions: Builder[]) {
		return new Builder().ifAll(expressions);
	}

	/** The node being worked on. Guaranteed to be the last child of its parent */
	private workNode: BaseNode = new RootNode();
	public readonly root: RootNode = this.workNode as RootNode;

	toString(): string {
		return this.root.toString();
	}

	field(name = "") {
		if (!(this.workNode instanceof VariableNode)) {
			const variableNode = new VariableNode({ data: { variableName: name } });
			this.workNode = this.workNode.appendChild(variableNode);
		} else {
			if (name.length) {
				this.workNode.data.variableName = `${this.workNode.data.variableName}/${name}`;
			}
		}
		return this;
	}

	/**
	 * When predicate is omitted, the filter checks if the list has any content.
	 */
	any(predicate?: ItemPredicate) {
		return this.collectionFilter("any", predicate);
	}
	all(predicate: ItemPredicate) {
		return this.collectionFilter("all", predicate);
	}

	private collectionFilter(filterFunction: CollectionFilterData["filterFunction"], predicate?: ItemPredicate) {
		// Create a new root node each time the field is used. This prevents state pollution across multiple expression trees
		const itemFactory = (name?: string) => new Builder().field(`i${name?.length ? `/${name}` : ""}`);
		const innerCondition = predicate?.(itemFactory).root.content;
		const lambda = innerCondition ? new LambdaNode({ data: { variableName: "i" }, children: [innerCondition] }) : undefined;

		const collectionFilter = new CollectionFilterNode({
			data: {
				filterFunction,
			},
			children: [this.workNode, ...(lambda ? [lambda] : [])],
		});

		return this.wrapWorkNodeWith(collectionFilter);
	}

	isOneOf(listOfStrings: string[], delimiter?: string) {
		const searchInNode = new SearchInNode({ data: { values: listOfStrings, delimiter }, children: [this.workNode] });

		return this.wrapWorkNodeWith(searchInNode);
	}

	ifAny(conditions: Builder[]) {
		if (!conditions.length) return this;

		// assemble a tree under a new grouped root, then append to previous work node
		const isolatedBuilder = this.getLogicChain(conditions, "or");
		this.workNode = this.workNode.appendChild(isolatedBuilder.root.content);
		return this;
	}

	ifAll(conditions: Builder[]) {
		if (!conditions.length) return this;

		const isolatedBuilder = this.getLogicChain(conditions, "and");
		this.workNode = this.workNode.appendChild(isolatedBuilder.root.content);
		return this;
	}

	private getLogicChain(conditions: Builder[], operator: BinaryLogicOperator) {
		const isolatedBuilder = new Builder();

		const nodes = conditions.map((condition) => condition.root.content);
		isolatedBuilder.workNode = isolatedBuilder.root.appendChild(nodes[0]);
		nodes.slice(1).reduce((_previous, current) => {
			isolatedBuilder[operator];
			isolatedBuilder.workNode = isolatedBuilder.workNode.appendChild(current);
			return isolatedBuilder;
		}, isolatedBuilder);

		return isolatedBuilder;
	}

	gt(target: ConstantDataType) {
		return this.compare("gt", target);
	}
	ge(target: ConstantDataType) {
		return this.compare("ge", target);
	}
	eq(target: ConstantDataType) {
		return this.compare("eq", target);
	}
	ne(target: ConstantDataType) {
		return this.compare("ne", target);
	}
	le(target: ConstantDataType) {
		return this.compare("le", target);
	}
	lt(target: ConstantDataType) {
		return this.compare("lt", target);
	}

	private compare(operator: CompareOperator, target: ConstantDataType) {
		// we know the left operator is either a function call or a variable. No grouping needed.
		const compareNode = new CompareNode({
			data: { operator },
			children: [this.root.content, new ConstantNode({ data: target })],
		});

		this.root.children = [compareNode];
		this.workNode = compareNode;
		return this;
	}

	get and() {
		const pathToRoot = this.root.traverseLastChildrenTo(this.workNode)?.reverse();
		if (!pathToRoot) throw new Error("Conjunction requires workNode to be a last child");

		// Stop at root.child because that's the last comparable node on the path
		const leftExpression = pathToRoot.find((node) => node === this.root.content || (node.precedence ?? +Infinity) >= precedenceMap["and"])!;
		const joinedExpression = new BinaryLogicNode({ data: { operator: "and" }, children: [leftExpression] });

		this.workNode = leftExpression;
		return this.wrapWorkNodeWith(joinedExpression);
	}

	get or() {
		// since we know OR has the lowest precedence, it's safe to use it as the new root
		const logicNode = new BinaryLogicNode({ data: { operator: "or" }, children: [this.root.content] });

		this.root.children = [logicNode];
		this.workNode = logicNode;
		return this;
	}

	not(condition: BaseNode | boolean) {
		const logicNode = new NegateLogicNode();
		if (typeof condition === "boolean") {
			logicNode.appendChild(new ConstantNode({ data: condition }));
		} else {
			logicNode.appendChild(condition);
		}

		this.root.children = [logicNode];
		this.workNode = logicNode;
		return this;
	}

	/**
	 * Create a new node that contains the old node as its 1st child.
	 * The old node's parent will receive the updated reference to the new node.
	 *
	 * This algorithm relies on the guarantee that workNode is always the last child of its parent.
	 *
	 * The wrapper node will become the workNode for the builder.
	 */
	private wrapWorkNodeWith(wrapper: BaseNode) {
		if (this.workNode instanceof RootNode) throw new Error("rootNode cannot be wrapped");

		const pathToRoot = this.root.traverseLastChildrenTo(this.workNode)?.reverse();
		if (!pathToRoot) throw new Error("workNode must be on the right most branch of the expression tree");

		this.workNode = this.wrapNodeWith(this.workNode, wrapper, pathToRoot);
		return this;
	}

	private wrapNodeWith(innerNode: BaseNode, wrapper: BaseNode, pathToRoot: BaseNode[]) {
		const oldParent = pathToRoot[pathToRoot.indexOf(innerNode)! + 1];
		return oldParent.replaceChild(innerNode, wrapper);
	}
}
