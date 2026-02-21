# Alumilive Alpha API/Event Spec (Implementable v0.2)

## 1) Scope
This spec covers:
- Content sync and deck management APIs
- Private room flow (create/join/ready/start)
- Realtime match actions and authoritative state sync
- Validation rules and error contract

Date: 2026-02-20
Version: `alpha-v0.2`

## 2) Standards
- Transport:
  - REST over HTTPS for account/content/deck/room metadata
  - WebSocket (Socket.IO or raw WS with same payload envelope) for realtime match
- Content type: `application/json; charset=utf-8`
- Time format: ISO-8601 UTC (example: `2026-02-20T08:00:00Z`)
- IDs: ULID/UUID strings
- Numeric invariants:
  - `mana` 0..10
  - `sideStacks` 0..10
  - `combo` 0..3

## 3) Auth and Versioning
### 3.1 Auth
Use Bearer token on both REST and WS handshake.

Header:
```http
Authorization: Bearer <access_token>
```

### 3.2 API version
- REST base: `/api/v1`
- WS namespace: `/ws/v1`
- Client must send `clientVersion` and `contentVersion`.
- Server rejects outdated content with `CONTENT_VERSION_MISMATCH`.

## 4) Shared Envelope
All WS messages use this envelope.

```json
{
  "v": "1",
  "event": "action:play_card",
  "requestId": "7e7f5af6-6006-4d2e-b65f-6e4d40f8f3d4",
  "matchId": "M_01J4KZ7Y8P2M0Y",
  "sentAt": "2026-02-20T08:11:02.123Z",
  "payload": {}
}
```

Rules:
- `requestId` required for all client->server commands.
- Server responses echo `requestId` when applicable.
- `matchId` required for in-match actions.

## 5) Core State Model
`GameState` snapshot returned by `state:snapshot`:

```json
{
  "matchId": "M_01J4KZ7Y8P2M0Y",
  "stateVersion": 42,
  "status": "IN_PROGRESS",
  "turnNumber": 7,
  "phase": "MAIN",
  "activePlayerId": "P_A",
  "priorityPlayerId": "P_A",
  "turnEndsAt": "2026-02-20T08:12:15.000Z",
  "players": {
    "P_A": {
      "king": { "cardId": "K_HEAVEN_SOLARIS", "hp": 16, "ultimateUsed": false },
      "commander": {
        "cardId": "C_HEAVEN_VALORIA",
        "instanceId": "U_CMD_A",
        "hp": 3,
        "slot": "F2",
        "auraMode": "PULSE",
        "burstUsed": false,
        "pulseCooldownRemaining": 1
      },
      "mana": { "current": 4, "max": 7 },
      "sideStacks": 2,
      "combo": 1,
      "deckCount": 12,
      "hand": [
        {
          "instanceId": "H_A_03",
          "cardId": "D_S_BLAZE_BOLT"
        }
      ],
      "board": {
        "F1": null,
        "F2": { "instanceId": "U_A_1", "cardId": "D_U_SHIELD_RECRUIT", "atk": 1, "hp": 1, "exhausted": true, "keywords": ["TAUNT"] },
        "F3": null,
        "B1": null,
        "B2": null,
        "B3": null
      },
      "graveyardCount": 5,
      "fatigue": 0
    },
    "P_B": {
      "king": { "cardId": "K_DEMON_MALZEK", "hp": 14, "ultimateUsed": true },
      "commander": {
        "cardId": "C_DEMON_GOREL",
        "instanceId": "U_CMD_B",
        "hp": 2,
        "slot": "F1",
        "auraMode": "BURST",
        "burstUsed": true,
        "pulseCooldownRemaining": 0
      },
      "mana": { "current": 2, "max": 7 },
      "sideStacks": 4,
      "combo": 0,
      "deckCount": 10,
      "handCount": 4,
      "board": {
        "F1": { "instanceId": "U_B_9", "cardId": "D_U_GRAVE_GUARD", "atk": 2, "hp": 2, "exhausted": false, "keywords": ["TAUNT"] },
        "F2": null,
        "F3": null,
        "B1": null,
        "B2": null,
        "B3": null
      },
      "graveyardCount": 7,
      "fatigue": 0
    }
  },
  "lastAction": {
    "serverActionId": "SA_000042",
    "type": "action:play_card",
    "actorPlayerId": "P_A"
  }
}
```

Visibility rules:
- Self: full hand shown
- Opponent: only `handCount`
- Hidden deck order is never exposed

## 6) REST API

## 6.1 `POST /api/v1/auth/guest`
Create guest identity.

Request:
```json
{ "deviceId": "ios-01abc", "displayName": "PlayerOne" }
```

Response 200:
```json
{
  "playerId": "P_A",
  "accessToken": "jwt",
  "expiresInSec": 86400
}
```

## 6.2 `GET /api/v1/content/version`
Response 200:
```json
{
  "schemaVersion": "1",
  "contentVersion": "ALPHA_001.2026-02-20",
  "contentHash": "sha256:..."
}
```

## 6.3 `GET /api/v1/cards?set=ALPHA_001`
Response 200:
```json
{
  "set": "ALPHA_001",
  "cards": [
    { "id": "D_U_SHIELD_RECRUIT", "...": "..." }
  ]
}
```

## 6.4 `POST /api/v1/decks`
Create deck.

Request:
```json
{
  "name": "Heaven Tempo",
  "kingId": "K_HEAVEN_SOLARIS",
  "commanderId": "C_HEAVEN_VALORIA",
  "commanderAuraMode": "PULSE",
  "cardIds": [
    "D_U_SHIELD_RECRUIT",
    "D_U_SHIELD_RECRUIT",
    "D_S_BLAZE_BOLT"
  ]
}
```

Response 201:
```json
{
  "deckId": "DCK_01J4...",
  "valid": true,
  "errors": []
}
```

Validation:
- Deck size exactly 24
- Max copies per card = 2
- Faction constraints from chosen king
- Human king cannot include `SKILL_RACE`

## 6.5 `POST /api/v1/decks/validate`
Request:
```json
{
  "kingId": "K_HUMAN_AUREN",
  "commanderId": "C_DEMON_NYXA",
  "commanderAuraMode": "BURST",
  "cardIds": ["..."]
}
```

Response 200:
```json
{
  "valid": false,
  "errors": [
    {
      "code": "DECK_FORBIDDEN_CARD_TYPE",
      "detail": "K_HUMAN_AUREN forbids SKILL_RACE"
    }
  ]
}
```

## 6.6 `POST /api/v1/rooms`
Request:
```json
{
  "mode": "PRIVATE",
  "name": "Room for friends",
  "maxPlayers": 2
}
```

Response 201:
```json
{
  "roomId": "R_01J4...",
  "joinCode": "Q7H9K2",
  "hostPlayerId": "P_A"
}
```

## 6.7 `POST /api/v1/rooms/{roomId}/join`
Request:
```json
{ "joinCode": "Q7H9K2" }
```

Response 200:
```json
{
  "roomId": "R_01J4...",
  "joined": true
}
```

## 7) WebSocket Events

## 7.1 Room flow events

### Client -> Server
- `room:subscribe`
- `room:leave`
- `loadout:lock`
- `room:start`

`loadout:lock` payload:
```json
{
  "roomId": "R_01J4...",
  "deckId": "DCK_01J4...",
  "kingId": "K_HEAVEN_SOLARIS",
  "commanderId": "C_HEAVEN_VALORIA",
  "commanderAuraMode": "PULSE"
}
```

### Server -> Client
- `room:state`
- `room:updated`
- `room:error`
- `game:starting`

`room:state` payload:
```json
{
  "roomId": "R_01J4...",
  "status": "WAITING",
  "hostPlayerId": "P_A",
  "players": [
    {
      "playerId": "P_A",
      "displayName": "PlayerOne",
      "ready": true,
      "loadoutLocked": true
    },
    {
      "playerId": "P_B",
      "displayName": "PlayerTwo",
      "ready": false,
      "loadoutLocked": false
    }
  ]
}
```

Start condition:
- Exactly 2 players present
- Both `loadoutLocked=true`
- Host sends `room:start`

## 7.2 Match events

### Client -> Server (actions)
- `action:play_card`
- `action:attack`
- `action:use_commander_aura`
- `action:use_ultimate`
- `action:end_turn`
- `action:concede`
- `state:resync_request`

#### `action:play_card`
```json
{
  "clientActionId": "CA_001",
  "cardInstanceId": "H_A_03",
  "summonSlot": "F1",
  "target": {
    "owner": "ENEMY",
    "zone": "UNIT_ANY",
    "selector": "CHOSEN",
    "instanceId": "U_B_9"
  }
}
```

Rules:
- `summonSlot` required for `UNIT` and `COMMANDER` deploy
- `target` required when card ability requires chosen target
- `clientActionId` idempotency key per match+player

#### `action:attack`
```json
{
  "clientActionId": "CA_002",
  "attackerInstanceId": "U_A_1",
  "target": {
    "owner": "ENEMY",
    "zone": "BOARD_FRONT",
    "selector": "CHOSEN",
    "instanceId": "U_B_9"
  }
}
```

Rules:
- Attacker must belong to active player
- Attacker must not be exhausted
- Melee must attack same-column front target when enemy front exists
- Ranged must target enemy front while any enemy front exists unless attacker has `SNIPER`

#### `action:use_commander_aura`
```json
{
  "clientActionId": "CA_003",
  "target": {
    "owner": "ALLY",
    "zone": "UNIT_ANY",
    "selector": "CHOSEN",
    "instanceId": "U_A_1"
  }
}
```

Rules:
- Aura mode fixed at loadout lock (`BURST` or `PULSE`)
- `BURST`: use once per match
- `PULSE`: usable when cooldown is 0, then set to 2

#### `action:use_ultimate`
```json
{
  "clientActionId": "CA_004"
}
```

Rules:
- `ultimateUsed` must be false
- Current turn must be >= `unlockTurnMin`
- Consumes king ultimate immediately

#### `action:end_turn`
```json
{ "clientActionId": "CA_005" }
```

### Server -> Client (match updates)
- `action:accepted`
- `action:rejected`
- `state:patch`
- `state:snapshot`
- `turn:changed`
- `turn:timer`
- `game:over`

`action:accepted` payload:
```json
{
  "requestId": "7e7f5af6-6006-4d2e-b65f-6e4d40f8f3d4",
  "clientActionId": "CA_001",
  "serverActionId": "SA_000043",
  "stateVersion": 43
}
```

`action:rejected` payload:
```json
{
  "requestId": "7e7f5af6-6006-4d2e-b65f-6e4d40f8f3d4",
  "clientActionId": "CA_001",
  "error": {
    "code": "INVALID_TARGET",
    "message": "Enemy frontline exists. Ranged must target frontline first.",
    "retryable": true
  }
}
```

`state:patch` payload:
```json
{
  "stateVersionFrom": 42,
  "stateVersionTo": 43,
  "patch": [
    { "op": "replace", "path": "/players/P_A/mana/current", "value": 2 },
    { "op": "add", "path": "/players/P_A/board/F1", "value": { "instanceId": "U_A_7", "cardId": "D_U_SHIELD_RECRUIT", "atk": 1, "hp": 2, "exhausted": true, "keywords": ["TAUNT"] } },
    { "op": "remove", "path": "/players/P_A/hand/1" }
  ],
  "combatLog": [
    "P_A played D_U_SHIELD_RECRUIT to F1"
  ]
}
```

`state:snapshot` is the full `GameState` object and is mandatory on reconnect.

## 8) Turn Timer and Auto Rules
- Base turn time: 75 seconds
- Rope overtime: 15 seconds
- On timeout:
  - if in MAIN/BATTLE phase: auto-end turn
  - pending mandatory discard: server auto-discards random until hand size <= 8
- Timer sync event:

```json
{
  "event": "turn:timer",
  "payload": {
    "turnEndsAt": "2026-02-20T08:12:15.000Z",
    "ropeStartsAt": "2026-02-20T08:12:00.000Z"
  }
}
```

## 9) Determinism and Ordering
- Server is authoritative and deterministic.
- Every accepted action increments `stateVersion` by 1.
- Actions are processed in strict order per match.
- RNG source is server-only seed + deterministic PRNG.
- Duplicate `clientActionId` returns same prior `action:accepted`/`action:rejected`.

## 10) Validation Matrix

## 10.1 Common action validation
1. Token valid and player belongs to match
2. Match status is `IN_PROGRESS`
3. Player is `activePlayerId`
4. Action matches current phase

## 10.2 Card play validation
1. Card instance exists in player hand
2. Mana and side stack costs are sufficient
3. Card requirements pass (`class/race/faction/combo`)
4. Target shape and legality pass
5. Summon slot is empty and legal for deployment (`FRONT_ONLY`, `BACK_ONLY`)

## 10.3 Attack validation
1. Attacker exists, owned by actor, not exhausted
2. Attacker can attack this phase
3. Target legal under frontline/range/sniper rules

## 11) Error Codes
Game-specific error payload:

```json
{
  "code": "INSUFFICIENT_MANA",
  "message": "Need 3 mana, have 2",
  "retryable": true
}
```

Code list:
- `NOT_YOUR_TURN`
- `INVALID_PHASE`
- `CARD_NOT_IN_HAND`
- `INSUFFICIENT_MANA`
- `INSUFFICIENT_SIDE_STACK`
- `REQUIREMENT_NOT_MET`
- `INVALID_TARGET`
- `SLOT_OCCUPIED`
- `DEPLOYMENT_INVALID`
- `ATTACKER_EXHAUSTED`
- `FRONTLINE_MUST_BE_TARGETED`
- `ULTIMATE_ALREADY_USED`
- `ULTIMATE_LOCKED`
- `AURA_ALREADY_USED`
- `AURA_ON_COOLDOWN`
- `CONTENT_VERSION_MISMATCH`
- `STATE_OUT_OF_SYNC`
- `ACTION_DUPLICATE`

HTTP mapping for REST:
- 400 bad request schema
- 401 unauthorized
- 403 forbidden
- 404 not found
- 409 conflict or illegal state
- 422 validation failed
- 429 rate limit

## 12) Reconnect and Resync
Reconnect flow:
1. Client reconnects WS with token
2. Send `session:resume` with last known `stateVersion`
3. Server behavior:
   - if exact continuity available: send missing `state:patch`
   - otherwise: send full `state:snapshot`

`session:resume` payload:
```json
{
  "matchId": "M_01J4KZ7Y8P2M0Y",
  "lastKnownStateVersion": 39
}
```

If client detects mismatch during patch apply:
- send `state:resync_request`
- server replies `state:snapshot`

## 13) Minimal Persistence Model
Recommended tables/collections:
- `players(id, display_name, created_at)`
- `decks(id, player_id, king_id, commander_id, aura_mode, created_at)`
- `deck_cards(deck_id, card_id, qty)`
- `rooms(id, host_player_id, join_code, status, created_at)`
- `room_players(room_id, player_id, loadout_json, ready)`
- `matches(id, room_id, status, started_at, ended_at, winner_player_id)`
- `match_actions(id, match_id, state_version, actor_player_id, action_json, created_at)`
- `match_snapshots(match_id, state_version, state_json, created_at)`

## 14) Security and Rate Limits
- REST: 60 req/min/player baseline
- WS action rate: 8 actions / 3 seconds / player
- Server rejects oversized payloads (>16 KB action payload)
- Never trust client-side derived values (`damage`, `hp`, `costPaid`)

## 15) Acceptance Checklist (Alpha)
- Deck validation rejects illegal faction and forbidden card types
- Action idempotency works by `clientActionId`
- Reconnect restores exact state with snapshot
- Frontline targeting rules enforced server-side
- Ultimate and aura usage constraints enforced
- `stateVersion` monotonic and gap-free per match
