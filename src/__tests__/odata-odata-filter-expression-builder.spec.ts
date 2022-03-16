import { describe, expect, it } from "vitest";
import {
  EmptyVariableNameError,
  InvalidVariableNameError,
} from "../lib/odata-syntax";
import {
  Expression,
  field,
  ifAll,
  ifAny,
  not,
} from "../odata-filter-expression-builder";

describe("Variable", () => {
  it("Empty varialbe", () => {
    expect(() => field("").toString()).toThrow(EmptyVariableNameError);
  });

  it("Variable", () => {
    assert(field("foo"), "foo");
  });

  it("Path", () => {
    assert(field("foo/bar"), "foo/bar");
  });

  it("Chainable", () => {
    assert(field("foo").field("bar"), "foo/bar");
  });

  it("All characters", () => {
    assert(field("_azAZ09_"), "_azAZ09_");
  });

  it("Illegal key", () => {
    expect(() => field("0_azAZ09_").toString()).toThrow(
      InvalidVariableNameError
    );
  });
});

describe("Constants", () => {
  it("Number", () => {
    assert(field("foo").eq(0), "foo eq 0");
  });

  it("Null", () => {
    assert(field("foo").eq(null), "foo eq null");
  });

  it("String", () => {
    assert(field("foo").eq("bar"), "foo eq 'bar'");
    assert(field("foo").eq("I'm legend"), "foo eq 'I''m legend'");
  });

  it("Date", () => {
    assert(
      field("foo").eq(new Date("2020-01-01T00:00Z")),
      "foo eq 2020-01-01T00:00:00.000Z"
    );
  });
});

describe("Logical expression", () => {
  it("AND", () => {
    assert(field("foo").and.field("bar"), "foo and bar");
  });

  it("OR", () => {
    assert(field("foo").or.field("bar"), "foo or bar");
  });

  it("NOT", () => {
    assert(not(true), "not true");
    assert(not(field("foo")), "not foo");
    assert(not(field("a").and.field("b")), "not (a and b)"); // TODO Future improvements: convert to "a OR b"
    assert(not(not(field("foo"))), "not not foo"); // TODO Future improvements: remove any pairs of NOT
  });

  it("Chainable", () => {
    assert(
      field("a").and.field("b").or.field("c").and.field("d"),
      "a and b or c and d"
    );
    assert(
      field("a").or.field("b").and.field("c").or.field("d"),
      "a or b and c or d"
    );
    assert(field("a").field("b").and.field("c").field("d"), "a/b and c/d");
  });
});

describe("Compare expression", () => {
  it("Compare variable to constant", () => {
    assert(field("foo").eq(true), "foo eq true");
    assert(field("foo").eq(null), "foo eq null");
    assert(field("foo").gt(100), "foo gt 100");
    assert(field("foo").eq("bar"), "foo eq 'bar'");
    assert(
      field("foo").eq(new Date("2000-01-01T00:00Z")),
      "foo eq 2000-01-01T00:00:00.000Z"
    );
  });

  it("Chainable", () => {
    assert(
      field("foo").gt(100).and.field("bar").lt(200),
      "foo gt 100 and bar lt 200"
    );
    // TODO Future improvements
    // assert(field("foo").gt(100).lt(200), "foo gt 100 and foo lt 200");
  });

  it("Compare function to variable", () => {
    assert(
      field("foo").isOneOf(["a", "b"]).eq(false),
      "search.in(foo, 'a, b') eq false"
    );
  });
});

describe("Collection filter function", () => {
  it("any without lambda", () => {
    assert(field("links").any(), "links/any()");
  });

  it("any", () => {
    assert(
      field("links").any((item) => item().eq("www.wikipedia.org")),
      "links/any(i: i eq 'www.wikipedia.org')"
    );
  });

  it("all with subfield", () => {
    assert(
      field("meta/readers").all((item) => item("isPremium").eq(true)),
      "meta/readers/all(i: i/isPremium eq true)"
    );
  });

  it("all with multi-segment subfield", () => {
    assert(
      field("meta/readers").all((item) => item("props/isPremium").eq(true)),
      "meta/readers/all(i: i/props/isPremium eq true)"
    );
  });

  it("all with nested subfields", () => {
    assert(
      field("meta/readers").all((item) =>
        item("props").field("isPremium").eq(true)
      ),
      "meta/readers/all(i: i/props/isPremium eq true)"
    );
  });

  it("Nestable", () => {
    assert(
      field("foo").any((item) => item().all((item) => item().eq(true))),
      "foo/any(i: i/all(i: i eq true))"
    );
  });

  it("Mestable with logic set", () => {
    assert(
      field("foo").any((item) => ifAny([item().eq("x"), item().eq("y")])),
      "foo/any(i: i eq 'x' or i eq 'y')"
    );
  });
});

describe("Boolean function", () => {
  it("search.in() on single value", () => {
    assert(field("foo").isOneOf(["a", "b"]), "search.in(foo, 'a, b')");
  });

  it("search.in() on single value with custom delimiter", () => {
    assert(field("foo").isOneOf(["a", "b"], "|"), "search.in(foo, 'a|b', '|')");
  });

  it("search.in() on non-string type", () => {
    // Future improvements: auto expand to disjunctive logical expression when content are not all strings
    // assert(field("foo").isOneOf(["a", 2, null, true]), "foo eq 'a' or foo eq 2 or foo eq null or foo eq true");
  });

  it("search.in() on collection", () => {
    assert(
      field("foo").any((item) => item().isOneOf(["a", "b"])),
      "foo/any(i: search.in(i, 'a, b'))"
    );
  });

  it("search.in() on collection with custom delimiter", () => {
    assert(
      field("foo").any((item) => item("bar").isOneOf(["a", "b"], "::")),
      "foo/any(i: search.in(i/bar, 'a::b', '::'))"
    );
  });
});

describe("Top level logic set", () => {
  it("Empty set", () => {
    assert(ifAny([]), "");
  });

  it("ifAny", () => {
    assert(ifAny([field("foo"), field("bar")]), "foo or bar");
  });

  it("ifAny with inner simple expressions", () => {
    assert(
      ifAny([field("foo").and.field("bar"), field("fizz").and.field("bazz")]),
      "foo and bar or fizz and bazz"
    );
  });

  it("ifAny with inner compare expressions", () => {
    assert(
      ifAny([field("foo").eq(1), field("bar").eq(2)]),
      "foo eq 1 or bar eq 2"
    );
  });

  it("ifAll", () => {
    assert(ifAll([field("foo"), field("bar")]), "foo and bar");
  });

  it("ifAll with inner logic expression", () => {
    assert(
      ifAll([field("foo").or.field("bar"), field("fizz").or.field("bazz")]),
      "(foo or bar) and (fizz or bazz)"
    );
  });

  it("Chainable", () => {
    assert(
      ifAny([field("foo"), field("bar")]).and.ifAny([
        field("fizz"),
        field("bazz"),
      ]),
      "(foo or bar) and (fizz or bazz)"
    );
    assert(
      ifAny([field("foo"), field("bar")]).or.ifAny([
        field("fizz"),
        field("bazz"),
      ]),
      "foo or bar or fizz or bazz"
    );
    assert(
      ifAll([field("foo"), field("bar")]).and.ifAll([
        field("fizz"),
        field("bazz"),
      ]),
      "foo and bar and fizz and bazz"
    );
    assert(
      ifAll([field("foo"), field("bar")]).or.ifAll([
        field("fizz"),
        field("bazz"),
      ]),
      "foo and bar or fizz and bazz"
    );
  });
});

function assert(builderObject: Expression, expected: string) {
  const actual = builderObject.toString();
  expect(actual).toBe(expected);
}
