# Account deletion

**Decision (24 September 2026, the school's):** accounts are created and
administered by the school office, so deletion is a **request the school handles**.
The app has no self-service delete, and no public deletion web resource is needed.

This document records why that is correct, what the app does instead, and the one
condition that would change it. Keep it in step with the school's published privacy
policy §11 (`https://schoolnnnnass.vercel.app/privacy-policy`), `app/account.tsx`,
`lib/accountDeletion.ts` and `supabase/migrations/20260923106000_parent_app_functions.sql`.

## 1. Why Google Play's deletion requirement is not triggered

Play's User Data policy requires, for apps that allow users to **create an account
from within the app**, both an in-app deletion path *and* a publicly reachable web
resource. Google's own FAQ widens "from within the app" to include an app that
"directs the user to an app account creation flow outside of the app".

Neither applies here:

- the app has no sign-up screen — `context/AuthContext.tsx` only signs existing
  accounts in;
- the app never directs anyone to a creation flow;
- accounts are created by the school office, and the sign-in details are delivered
  to the parent by the school (the published policy §3 says exactly this).

The FAQ also notes that "accounts that are created and operated offline are not app
accounts and do not fall within policy scope". All developers must still complete
the **Data deletion questions in the Data safety form** (Play Console → App
content) regardless — those answers must say that accounts are not created in the
app, which is why no deletion URL is requested or shown.

## 2. The condition that changes this

**If the app ever gains self-service account creation** — or is ever changed so it
sends users into a creation flow of its own — then Play requires *both* an in-app
deletion path *and* a public web resource, and the school must host a deletion page
and set `ACCOUNT_DELETION_URL`. `tests/config/app-config.test.mjs` asserts the URL
is deliberately absent, and `tests/db/rpc.test.mjs` asserts that no
account-deleting database function exists, so this decision cannot be undone by
accident.

## 3. What the app does instead

**More → Close account** (`app/account.tsx`) sends a request, with an optional
reason:

| Step | What happens |
| --- | --- |
| The parent sends the request | `request_account_deletion(reason)` writes one row into `account_deletion_requests`. **Nothing is deleted, and the account stays active.** |
| The office reviews it | Administrators are the only readers of that table. |
| The office acts | The office confirms with the parent, then closes the account and removes the family's data on the school's side. |

The parent can also write to the school directly — `SUPPORT_EMAIL`
(`lettersper3@gmail.com`) — or by phone, as the published policy §11 and §12
describe.

## 4. What is removed, and what the school keeps

The distinction the screen and the published policy both make:

- **Removed when the school closes the account:** sign-in access and password, the
  parent's name, email and phone numbers, messages with teachers, the device push
  token, and learning progress / quiz attempts.
- **Kept by the school, de-linked from the parent:** the child's enrolment record,
  attendance, homework and marks. The live schema links `students."parentId"` to
  `profiles.id` without a cascade, so removal clears the link rather than the
  child's record — which is the point. Academic records are kept under the school's
  record-keeping duty; a family can ask the office to correct or remove them.

**No column is added anywhere to mark retention.** The request trail records who
asked, when, and why; the school's records do the rest.

## 5. Audit trail

`account_deletion_requests` (created by `20260923106000`) holds one row per request:
profile, email, timestamp, optional reason, status. Administrators can read it; only
the function writes it, and there is no client INSERT, UPDATE or DELETE path.

## 6. Manual steps for the school

- [ ] Decide who watches the request table and how quickly — the office should
      answer within a few days, and the policy promises a reply.
- [ ] When a request is actioned, record the outcome: the school's own procedure
      matters more than the row, since the row is only a request.
- [ ] `SUPPORT_EMAIL` in `constants/legal.ts` is the published privacy contact; keep
      it correct if the school's contact changes.

## 7. Verification

`tests/db/rpc.test.mjs` (4 assertions on the production-shaped fixture): the request
is recorded with the caller's own profile and deletes nothing (the account and the
children stay linked), an anonymous caller is refused, only administrators read the
trail, and **no account-deleting function exists in the database at all**.
