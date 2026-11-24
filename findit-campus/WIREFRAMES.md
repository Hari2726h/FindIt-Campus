# FindIt Campus — wireframes (Week 1)

Low-fidelity sketches for the screens built in Weeks 1-2. Visual design is
intentionally plain; the goal here is layout and information hierarchy.

## 1. Board (home)

```
+--------------------------------------------------------------+
| FindIt Campus          [Lost] [Found] [+ New post]  [Login]  |
+--------------------------------------------------------------+
| Search [___________]  Category [v]  Location [___]           |
+--------------------------------------------------------------+
| ( photo )  Black wallet near library        | ( photo ) ...  |
| category: wallet · lost 2 days ago · library|                |
| ( photo )  Blue water bottle                 | ( photo ) ... |
| category: bottle · found today · canteen     |                |
+--------------------------------------------------------------+
```
Tabs filter by `type=lost|found`. Each card = PostCard component.

## 2. New post form

```
+--------------------------------------------------+
| Post a: ( ) Lost item   ( ) Found item            |
+--------------------------------------------------+
| Category   [ dropdown ]                           |
| Title      [___________________________]          |
| Description[___________________________]          |
|            [___________________________]          |
| Date       [ date picker ]                         |
| Location   [___________________________]          |
| Photos     [ choose files ] (up to 5)              |
+--------------------------------------------------+
| -- only shown when "Found item" is selected --     |
| Hidden verification question                       |
|  "What should we ask the claimant to prove it's    |
|   theirs?" [___________________________]           |
|  Secret answer (never shown publicly)               |
|  [___________________________]                     |
|  note: "Only you will see this answer. The real     |
|  owner must type it correctly before you confirm."  |
+--------------------------------------------------+
|                                   [ Submit post ]  |
+--------------------------------------------------+
```

## 3. Post detail

```
+--------------------------------------------------+
| < Back to board                                   |
| [ photo gallery ]                                  |
| Black wallet                          [lost]       |
| category: wallet · 24 Nov 2026 · library           |
| Posted by Arjun                                    |
| Description: ...                                   |
|                                                     |
| -- found post only, viewed by someone else --       |
| Verification question:                              |
| "What is written on the inside flap?"               |
| [ Your answer ______________ ]  [ This is mine ]    |
+--------------------------------------------------+
```
The secret answer is never sent to the browser — only `questionText`.
Claim submission + finder confirm/reject is Week 5 scope (not built yet).

## 4. Login / Signup

```
+----------------------+       +----------------------+
| Login                |       | Sign up              |
| Email    [________]  |       | Name     [________]  |
| Password [________]  |       | Email    [________]  |
| [ Log in ]           |       | College ID [______]  |
| No account? Sign up  |       | Password [________]  |
+----------------------+       | [ Create account ]   |
                                +----------------------+
```

## 5. My posts

```
+--------------------------------------------------+
| My posts                                           |
| Black wallet (lost, open)        [Edit] [Delete]   |
| Blue bottle (found, open)        [Edit] [Delete]   |
+--------------------------------------------------+
```

Screens not wireframed yet (later weeks): match suggestions list, claim/
confirm flow, chat window, admin/report dashboard.
