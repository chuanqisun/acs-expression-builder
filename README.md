# ACS Expression Builder

An OData Filter Expression Builder for Azure Cognitive Search.

Supports

- [$filter](https://docs.microsoft.com/en-us/azure/search/search-query-odata-filter)
- [$orderBy](https://docs.microsoft.com/en-us/azure/search/search-query-odata-orderby) (future)
- [$select](https://docs.microsoft.com/en-us/azure/search/search-query-odata-select) (future)

## Get started

```bash
npm i acs-expression-builder
```

```javascript
import { field, ifAny } from "acs-expression-builder";
const exp = field("foo").any((item) => ifAny([item().eq("x"), item().eq("y")]));
console.log(exp); // foo/any(i: i eq 'x' or i eq 'y')
```

## Documentation

This project uses [test specs as documentation](./src/__tests__/filter-expression-builder.spec.ts)
