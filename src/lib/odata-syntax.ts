import { BaseNode, BaseNodeConfig } from "./node";

export const precedenceMap: Record<NegateLogicOperator | BinaryLogicOperator | CompareOperator, number> = {
	not: 4,
	gt: 3,
	ge: 3,
	eq: 3,
	ne: 3,
	le: 3,
	lt: 3,
	and: 2,
	or: 1,
};

export type CompareOperator = "gt" | "ge" | "eq" | "ne" | "le" | "lt";
export interface CompareData {
	operator: CompareOperator;
}

export class CompareNode extends BaseNode<CompareData> {
	readonly precedence = precedenceMap[this.data.operator];

	toString(): string {
		return `${this.children![0]} ${this.data.operator} ${this.children![1]}`;
	}
}

export interface SearchInData {
	values: string[];
	delimiter?: string;
}
export class SearchInNode extends BaseNode<SearchInData> {
	static DEFAULT_DELIMITER = ", ";

	toString() {
		const parts = [
			this.children![0].toString(),
			`'${this.data.values.join(this.data.delimiter ?? SearchInNode.DEFAULT_DELIMITER)}'`,
			...(this.data.delimiter ? [`'${this.data.delimiter}'`] : []),
		];
		return `search.in(${parts.join(", ")})`;
	}
}

export interface CollectionFilterData {
	filterFunction: "all" | "any";
}
export class CollectionFilterNode extends BaseNode<CollectionFilterData> {
	toString(): string {
		return `${this.children![0]}/${this.data.filterFunction}(${this.children![1]?.toString() ?? ""})`;
	}
}

export interface LambdaData {
	variableName: string;
}
export class LambdaNode extends BaseNode<LambdaData> {
	toString(): string {
		return `${this.data.variableName}: ${this.children![0].toString()}`;
	}
}

export interface VariableData {
	variableName: string;
}

export class VariableNode extends BaseNode<VariableData> {
	private static VARIABLE_PATTERN = /^([a-zA-Z_]\w*)(\/[a-zA-Z_]\w*)*/;

	toString(): string {
		if (!this.data.variableName.length) throw new EmptyVariableNameError("Empty variable name received");
		if (!this.data.variableName.match(VariableNode.VARIABLE_PATTERN)) throw new InvalidVariableNameError("Invalid variable");
		return this.data.variableName;
	}

	attendPath(identifier: string) {
		this.data.variableName = `${this.data.variableName}/${identifier}`;
	}
}

export class EmptyVariableNameError extends Error {}
export class InvalidVariableNameError extends Error {}

export type ConstantDataType = number | string | boolean | null | Date;

export class ConstantNode extends BaseNode<ConstantDataType> {
	toString() {
		if (this.data === null) {
			return "null";
		}

		switch (typeof this.data) {
			case "number":
			case "boolean":
				return this.data.toString();
			case "string":
				return `'${this.data.replace(`'`, `''`)}'`;
			default:
				return this.data.toISOString();
		}
	}
}

export interface BinaryLogicNodeConfig extends BaseNodeConfig {
	data: BinaryLogicData;
}

export interface BinaryLogicData {
	operator: BinaryLogicOperator;
}

export type BinaryLogicOperator = "and" | "or";

export class BinaryLogicNode extends BaseNode<BinaryLogicData> {
	readonly precedence: number;

	constructor(config: BinaryLogicNodeConfig) {
		super(config);
		this.precedence = precedenceMap[config.data.operator];
	}

	toString(): string {
		return `${this.renderChild(this.children![0])} ${this.data.operator} ${this.renderChild(this.children![1])}`;
	}
}

export type NegateLogicOperator = "not";

export class NegateLogicNode extends BaseNode {
	readonly precedence = precedenceMap["not"];

	toString(): string {
		return `not ${this.renderChild(this.children![0])}`;
	}
}
