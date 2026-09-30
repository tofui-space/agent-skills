# Tests and other checks as evidence

Read this when a reply cites tests, a type checker, a linter, or a reproduced bug as evidence.

A passing check is evidence only when it could have failed on the problem in question. Many checks cannot. State which kind of check it was, so the reader sees the gap.

| Situation | Gap to state | Example wording |
|---|---|---|
| Tests written in this session against the current code, never seen failing | They record what the code does now, not what it should do. A wrong result becomes "expected". | "The new tests pass, but I wrote them against the current code. They show the behavior did not change, not that it is correct." |
| Tests that only check that something runs, returns, or is not null | They pass for most bugs. | "The test only checks that the function returns a list. It would still pass if the list were wrong." |
| Mocks that replace the part under test | The real code path never ran. | "The database call is mocked, so this test never touched the query I changed." |
| A test seen failing before the fix and passing after | Small: it caught the bug, then saw the fix. State the input it covered. | "I ran the test before the fix, and it failed. After the fix, it passes. It covers a date that crosses midnight in UTC." |
| Tests that existed before this session and cover the changed path | Small: written by someone else against the intended behavior. | "The existing suite covers this path, and all of it passes." |
| A reproduced bug that no longer reproduces | Depends on how the bug was triggered. | "The crash reproduced with the old build and not with the new one, using the file you sent." |
| Type checker, compiler, or linter passes | Narrow: shapes and syntax only. | "The type checker passes, so the shapes line up. It says nothing about the values." |

The same applies to any check: say whether it could have failed.
