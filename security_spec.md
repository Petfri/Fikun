# Security Specification — Fikun

## Data Invariants
1. **Client Isolation**: Clients belong to a Group. Only members (facilitators/participants) of that group can read clients or create interactions.
2. **Interaction Integrity**: Only participants can create interactions. Only facilitators can update the `status` (approve/reject).
3. **Booking Exclusivity**: A `BookingSession` can only be booked if its status is `open`. A participant can only book for themselves.
4. **Registration Deadlines**: Participants cannot join a registration after the `deadline`.
5. **Role-Based Access**:
   - `admin`: Full access to everything.
   - `facilitator`: Can manage groups, clients, sessions, and registrations they are part of.
   - `participant`: Can read visible clients, create interactions, book sessions, and register for events in their group.

## The Dirty Dozen Payloads (Red Team Test Cases)

1. **Identity Spoofing (Client Creation)**: A participant attempts to create a new AI client in a group.
   - *Target*: `POST /groups/{groupId}/clients`
   - *Payload*: `{ "name": "Evil Client", "isVisible": true, "createdBy": "participant-uid" }`
   - *Expectation*: `PERMISSION_DENIED` (Only facilitators/admins can create clients).

2. **Privilege Escalation (User Profile)**: A participant attempts to update their own role to 'facilitator'.
   - *Target*: `PATCH /users/{participantUid}`
   - *Payload*: `{ "role": "facilitator" }`
   - *Expectation*: `PERMISSION_DENIED` (RBAC fields are immutable for non-admins).

3. **Cross-Group Access (Client Read)**: A user from Group A attempts to read a client from Group B.
   - *Target*: `GET /groups/group-B/clients/client-id`
   - *Expectation*: `PERMISSION_DENIED`.

4. **Status Shortcutting (Interaction Approval)**: A participant attempts to approve their own interaction.
   - *Target*: `PATCH /groups/{groupId}/clients/{clientId}/interactions/{interactionId}`
   - *Payload*: `{ "status": "approved" }`
   - *Expectation*: `PERMISSION_DENIED` (Only facilitators can update status).

5. **Resource Poisoning (Long ID)**: An attacker attempts to use a 1MB string as a Document ID.
   - *Target*: `/groups/{1MB_STRING}`
   - *Expectation*: `PERMISSION_DENIED` (isValidId regex/size check).

6. **Shadow Update (Ghost Field)**: A facilitator updates a client but includes an unauthorized field like `isGlobalAdmin: true`.
   - *Target*: `PATCH /groups/{groupId}/clients/{clientId}`
   - *Payload*: `{ "name": "Updated Name", "isGlobalAdmin": true }`
   - *Expectation*: `PERMISSION_DENIED` (hasOnly check).

7. **The "Update-Gap" (Interaction)**: A participant attempts to change the `question` of an interaction after it was created.
   - *Target*: `PATCH /groups/{groupId}/clients/{clientId}/interactions/{interactionId}`
   - *Payload*: `{ "question": "New Question" }`
   - *Expectation*: `PERMISSION_DENIED` (Question is immutable for participants).

8. **Booking Hijack**: User A attempts to book a session already booked by User B.
   - *Target*: `PATCH /groups/{groupId}/sessions/{sessionId}`
   - *Payload*: `{ "status": "booked", "participantId": "User-A" }` (Session is already `booked` in state).
   - *Expectation*: `PERMISSION_DENIED` (State transition check: status must be `open`).

9. **PII Leak**: An authenticated participant attempts to list all users to find email addresses.
   - *Target*: `GET /users` (List)
   - *Expectation*: `PERMISSION_DENIED` (Lists on users collection must be restricted or partitioned).

10. **Orphaned Registration**: A participant signs up for a registration item that belongs to a different group.
    - *Target*: `POST /groups/group-A/registrations/reg-B/entries/participant-uid`
    - *Expectation*: `PERMISSION_DENIED` (The registration ID must follow the path).

11. **Timestamp Spoofing**: A participant sends a manual `timestamp` from the future to bypass a deadline.
    - *Target*: `POST /groups/{groupId}/registrations/{regId}/entries/uid`
    - *Payload*: `{ "timestamp": "2030-01-01T00:00:00Z" }`
    - *Expectation*: `PERMISSION_DENIED` (Must use `request.time`).

12. **Capacity Overfill (Atomic Write)**: A participant attempts to register for an event where `seatsAvailable` is 0.
    - *Target*: `POST /groups/{groupId}/registrations/{regId}/entries/uid`
    - *Expectation*: `PERMISSION_DENIED` (Validation must check related doc state).
