# C# library contracts

The current C# checker rejects all calls and has no contract format or contract executor.
Documentation about a library does not make the tool admit its calls. Report such code as
unsupported, or isolate an independently checkable decision when the reshape is authorized.

For future adapter/contract support, research the installed framework or NuGet version
using official documentation and source. Record the exact symbol/overload, inputs, returned
values, synchronous throws, faulted tasks and cancellation behavior. State which claims
were read, reproduced or remain unknown. Return types alone do not account for every exit.

A future executable contract must bind to the resolved assembly/package version, provide
reproducers for declared outcomes, and distinguish sampled observations from completeness.
It also needs call-site observation before its evidence can justify reconciliation. Until
that implementation exists, do not generate TypeScript contracts for C# or describe proposed
C# contract prose as checked evidence.
