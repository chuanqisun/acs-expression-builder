export interface BaseNodeConfig<T = any> {
	data?: T;
	children?: BaseNode[];
}

export abstract class BaseNode<DataType = any> {
	public children?: BaseNode[];
	public data!: DataType;
	readonly precedence?: number;

	constructor(config?: BaseNodeConfig<DataType>) {
		if (config?.children) {
			this.children = config.children;
		}

		if (config?.data !== undefined) {
			this.data = config.data;
		}
	}

	get lastChild(): BaseNode | undefined {
		return this.children?.slice(-1)[0];
	}

	toString(): string {
		return this.children?.map((child) => this.renderChild(child)).join(" ") ?? (this.data as any)?.toString?.() ?? "";
	}

	/**
	 * Note all nested values inside properties will not be cloned.
	 * This will make the children list empty.
	 * @returns a new instance of the node.
	 */
	shallowClone(): BaseNode<DataType> {
		return Object.assign(Object.create(Object.getPrototypeOf(this)), this);
	}

	/**
	 * A flat list of nodes, traversed with the given order.
	 * For non-binary trees, partition is the number of childs visited before the current node is visited.
	 */
	flatten(order: "in" | "pre" | "post" = "in", partition = 1): BaseNode[] {
		const children = (this.children ?? []).map((child) => child.flatten(order, partition)).flat();
		const nodesVisited = children.slice(0, partition);
		const nodesToVisit = children.slice(partition);

		switch (order) {
			case "in":
				return [...nodesVisited, this, ...nodesToVisit];
			case "pre":
				return [this, ...nodesVisited, ...nodesToVisit];
			case "post":
				return [...nodesVisited, ...nodesToVisit, this];
		}
	}

	/**
	 * Start from this node, traverse visit last child until target is found or leaf is reached.
	 * @return path to the found node, or undefined if no path exists
	 */
	traverseLastChildrenTo(target: BaseNode): BaseNode[] | undefined {
		if (target === this) return [this];

		const subPath = this.lastChild?.traverseLastChildrenTo(target);
		return subPath ? [this, ...subPath] : undefined;
	}

	/** @return appended child */
	appendChild(node: BaseNode): BaseNode {
		this.children = [...(this.children ?? []), node];
		return node;
	}

	/** @return new child  */
	replaceChild(oldChild: BaseNode, newChild: BaseNode): BaseNode {
		const oldChildIndex = this.children?.indexOf(oldChild) ?? -1;
		if (oldChildIndex < 0) throw new Error("The child to be replaced doesn't exist");

		this.children![oldChildIndex] = newChild;

		return newChild;
	}

	protected renderChild(childNode: BaseNode) {
		return this.shouldWrapChildInGroup(childNode) ? `(${childNode.toString()})` : childNode.toString();
	}

	private shouldWrapChildInGroup(childNode: BaseNode) {
		if (childNode.precedence === undefined || this.precedence === undefined) return false;
		return this.precedence > childNode.precedence;
	}
}

export class RootNode extends BaseNode {
	get content() {
		const child = this.lastChild;
		if (!child) {
			throw new Error("Root node must have a child");
		}

		return child;
	}
}
