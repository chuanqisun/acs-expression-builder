import { Builder } from "./lib/builder";
import { ConstantDataType } from "./lib/odata-syntax";

export type Expression = SingleExpression | CompoundExpression;

export interface SingleExpression {
	/** Select a field from the object */
	field: (name: string) => SingleExpression;
	and: EmptyExpression;
	or: EmptyExpression;
	/** Greater than */
	gt(constant: ConstantDataType): CompoundExpression;
	/** Greater than or equal to */
	ge(constant: ConstantDataType): CompoundExpression;
	/** Equal to */
	eq(constant: ConstantDataType): CompoundExpression;
	/** Not equal to */
	ne(constant: ConstantDataType): CompoundExpression;
	/** Less than or equal to */
	le(constant: ConstantDataType): CompoundExpression;
	/** Less than */
	lt(constant: ConstantDataType): CompoundExpression;
	/** When field holds a collection, check if any value in it satisfies the condition returned by the predicate function  */
	any(predicate?: (item: (name?: string) => SingleExpression) => Expression): CompoundExpression;
	/** When field holds a collection, check if all values in it satisfies the condition returned by the predicate function  */
	all(predicate: (item: (name?: string) => SingleExpression) => Expression): CompoundExpression;
	/** Check if field value is in the given list of strings. The selected field must contain a string typed value */
	isOneOf(listOfStrings: string[], delimiter?: string): CompoundExpression;
	/** Get the filter expression string */
	toString(): string;
}

export interface EmptyExpression {
	/** Select a field from the object */
	field: (name: string) => SingleExpression;
	/** Check if any expression in an array is true */
	ifAny: (input: Expression[]) => Expression;
	/** Check if all expressions in an array are true */
	ifAll: (input: Expression[]) => Expression;
	/** Check if the negated expression is true */
	not: (expression: Expression | boolean) => SingleExpression;
}

export interface CompoundExpression {
	and: EmptyExpression;
	or: EmptyExpression;
	/** Equal to */
	eq(constant: ConstantDataType): CompoundExpression;
	/** Get the filter expression string */
	toString(): string;
}

/** Select a field from the object */
export const field = Builder.field as any as EmptyExpression["field"];

/** Check if the negated expression is true */
export const not = Builder.not as any as EmptyExpression["not"];

/** Check if any expression in an array is true */
export const ifAny = Builder.ifAny as any as EmptyExpression["ifAny"];

/** Check if all expressions in an array are true */
export const ifAll = Builder.ifAll as any as EmptyExpression["ifAll"];
