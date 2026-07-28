# hl7v2

> Parse, query, build and re-encode HL7 v2.x messages — zero dependencies, TypeScript native.

[![npm version](https://img.shields.io/npm/v/@pritiranjan/hl7v2.svg)](https://www.npmjs.com/package/@pritiranjan/hl7v2)
[![CI](https://github.com/hkpritiranjan/hl7v2/actions/workflows/ci.yml/badge.svg)](https://github.com/hkpritiranjan/hl7v2/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Live Demo](https://img.shields.io/badge/Live%20Demo-hl7v2--react.vercel.app-3b9eff?logo=vercel&logoColor=white)](https://hl7v2-react.vercel.app)

**[🔴 Live Demo →](https://hl7v2-react.vercel.app)** — paste any HL7 message and see it parsed in real time. No installation required.

HL7 v2 is the most widely deployed healthcare messaging standard in the world — driving lab orders, ADT admissions, radiology reports, billing workflows, and much more. Yet every existing JavaScript library for it is either unmaintained, poorly typed, or missing key capabilities.

**hl7v2** provides a production-quality TypeScript implementation with:

- **Strict TypeScript** — `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, full generics
- **Round-trip fidelity** — `encode(parse(raw)) === raw`, critical for ACK generation and message forwarding
- **Zero runtime dependencies** — nothing to audit, nothing to break
- **1-based HL7 addressing** — `get(msg, 'PID', 5, 1)` maps directly to the HL7 spec's `PID.5.1`
- **Typed segment helpers** — `new PID(seg, msg.encoding).patientName()` returns `{ family, given, middle, ... }` not a raw string
- **ACK generator** — `createAck(msg, 'AA')` produces a complete, standards-compliant acknowledgement in one call
- **MLLP transport** — `MllpServer` / `MllpClient` via `@pritiranjan/hl7v2/mllp` — the TCP framing protocol used by every real-world interface engine
- **Message builder** — `new HL7Builder('ADT', 'A01', opts).addSegment(...).build()` constructs messages from scratch with a fluent API
- **6 additional typed segments** — EVN, MSA, ORC, OBR, DG1, NK1 with full accessor coverage
- **ESM + CJS** — works in Node.js, Deno, Bun, and bundlers (Webpack, Vite, esbuild)

---

## Table of contents

- [Installation](#installation)
- [Quick start](#quick-start)
- [Supported HL7 versions](#supported-hl7-versions)
- [API reference](#api-reference)
  - [parse()](#parse)
  - [encode()](#encode)
  - [Query API](#query-api)
  - [Typed segment helpers](#typed-segment-helpers)
  - [Message builder](#message-builder)
  - [Escape sequences](#escape-sequences)
  - [Date / time utilities](#date--time-utilities)
  - [ACK generation](#ack-generation)
  - [MLLP transport](#mllp-transport)
- [HL7Message structure](#hl7message-structure)
- [Real-world examples](#real-world-examples)
- [Live demo](#live-demo)
- [Contributing](#contributing)
- [License](#license)

---

## Installation

```bash
npm install @pritiranjan/hl7v2
# or
yarn add @pritiranjan/hl7v2
# or
pnpm add @pritiranjan/hl7v2
```

**Requires Node.js ≥ 18.** No runtime dependencies.

---

## Quick start

```typescript
import { parse, get, segment, segments, encode } from '@pritiranjan/hl7v2';
import { PID, OBX } from '@pritiranjan/hl7v2/segments';

const raw = `MSH|^~\\&|LAB|HOSPITAL|EHR|FACILITY|20240315150055||ORU^R01^ORU_R01|MSG001|P|2.5.1
PID|1||MRN123^^^HOSPITAL^MR||Doe^John^A||19800305|M
OBX|1|NM|718-7^Hemoglobin^LN||13.5|g/dL|13.5-17.5|N|||F`;

const msg = parse(raw);

// Convenience accessors on the top-level message object
console.log(msg.version);            // '2.5.1'
console.log(msg.messageType);        // { type: 'ORU', event: 'R01', structure: 'ORU_R01' }
console.log(msg.messageControlId);   // 'MSG001'
console.log(msg.sendingApplication); // 'LAB'

// Generic query API — field numbers follow the HL7 spec directly
const mrn      = get(msg, 'PID', 3, 1);  // PID.3.1 → 'MRN123'
const lastName = get(msg, 'PID', 5, 1);  // PID.5.1 → 'Doe'
const dob      = get(msg, 'PID', 7);     // PID.7   → '19800305'

// Typed segment helpers — IDE-friendly, no field numbers to memorise
const pid = new PID(segment(msg, 'PID'), msg.encoding);
const name = pid.patientName();
// → { family: 'Doe', given: 'John', middle: 'A', suffix: '', prefix: '', degree: '' }

// Iterate multiple OBX results
const obxList = segments(msg, 'OBX').map(s => new OBX(s, msg.encoding));
for (const obx of obxList) {
  console.log(obx.observationIdentifier().description); // 'Hemoglobin'
  console.log(obx.numericValue());                      // 13.5
  console.log(obx.units());                             // 'g/dL'
  console.log(obx.isFinal());                           // true
  console.log(obx.isCritical());                        // false
}

// Round-trip encode — byte-identical to the original input
const reEncoded = encode(msg);
```

---

## Supported HL7 versions

All HL7 v2.x versions from **v2.1** through **v2.8** are supported. The parser reads the encoding characters from MSH.1/MSH.2 and handles any valid separator configuration, including non-default characters.

Common message types handled: ADT, ORU, ORM, OML, SIU, MDM, DFT, BAR, ACK, QRY, RSP.

---

## API reference

### `parse()`

```typescript
function parse(raw: string, options?: ParseOptions): HL7Message
```

Parse an HL7 v2 message string into a structured object.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `raw` | `string` | The raw HL7 message. Supports `\r`, `\n`, or `\r\n` segment terminators. |
| `options.decodeEscapes` | `boolean` | Decode HL7 escape sequences in field values. Default: `false`. |

**Line endings**: `\r` (canonical HL7), `\n` (Unix), and `\r\n` (Windows) are all accepted and normalised internally. The detected line ending is preserved in `msg.lineEnding` and used by `encode()` to restore byte-identical output.

**Throws:**
- `InvalidHL7Error` — when the input is empty or does not start with `MSH`
- `HL7ParseError` — when a segment identifier or structure is malformed

```typescript
import { parse } from '@pritiranjan/hl7v2';

const msg = parse(rawString);
// msg.version, msg.messageType, msg.segments, ...

// With escape decoding (values become human-readable; NOT safe for re-encoding)
const decoded = parse(rawString, { decodeEscapes: true });
```

---

### `encode()`

```typescript
function encode(msg: HL7Message, options?: EncodeOptions): string
```

Encode a parsed message back into a raw HL7 string.

**Options:**

| Option | Type | Default | Description |
|---|---|---|---|
| `lineEnding` | `'\r' \| '\n' \| '\r\n'` | `msg.lineEnding` | Segment separator |
| `trailingNewline` | `boolean` | `false` | Append a line ending after the final segment |

**Round-trip guarantee**: when called on a message parsed with default options (`decodeEscapes` not set to `true`), `encode(parse(raw))` is byte-identical to `raw.trim()`.

```typescript
import { parse, encode } from '@pritiranjan/hl7v2';

const msg  = parse(rawString);
const back = encode(msg);              // identical to input
const crlf = encode(msg, { lineEnding: '\r\n' }); // Windows style
```

---

### Query API

All field addresses are **1-based**, matching the HL7 specification directly.

#### `segment(msg, id, options?)`

Return the first matching segment. Throws `SegmentNotFoundError` if absent.

```typescript
import { segment } from '@pritiranjan/hl7v2';

const pid = segment(msg, 'PID');

// Access a specific occurrence when segment repeats (1-based)
const obx2 = segment(msg, 'OBX', { segmentIndex: 2 });
```

#### `segments(msg, id)`

Return all matching segments as an array. Returns `[]`, never throws.

```typescript
import { segments } from '@pritiranjan/hl7v2';

const allOBX = segments(msg, 'OBX');
```

#### `hasSegment(msg, id)`

```typescript
import { hasSegment } from '@pritiranjan/hl7v2';

if (hasSegment(msg, 'PV1')) { /* ... */ }
```

#### `get(msg, segmentId, field, component?, subComponent?, options?)`

Extract a scalar string value. Returns `''` for missing elements — never throws.

```typescript
import { get } from '@pritiranjan/hl7v2';

get(msg, 'PID', 3)           // PID.3   — patient identifier
get(msg, 'PID', 5, 1)        // PID.5.1 — family name
get(msg, 'PID', 5, 2)        // PID.5.2 — given name
get(msg, 'PID', 11, 5)       // PID.11.5 — postal code

// Decode HL7 escape sequences in the returned value
get(msg, 'PID', 5, 1, 1, { decode: true })

// Second repetition (1-based)
get(msg, 'PID', 3, 1, 1, { repetition: 2 })
```

#### `getFromSegment(seg, msg, field, component?, subComponent?, options?)`

Like `get()` but operates on a pre-fetched `HL7Segment` — useful when iterating repeating segments.

```typescript
import { segments, getFromSegment } from '@pritiranjan/hl7v2';

for (const obx of segments(msg, 'OBX')) {
  const value = getFromSegment(obx, msg, 5);   // OBX.5
  const loinc = getFromSegment(obx, msg, 3, 1); // OBX.3.1 — LOINC code
}
```

#### `getRepetitions(msg, segmentId, field, options?)`

Return all repetitions of a field as a `string[][][]` — one entry per repetition preserving the `[component][subComponent]` structure.

```typescript
import { getRepetitions } from '@pritiranjan/hl7v2';

// PID.3 repeats for multiple patient identifiers
const ids = getRepetitions(msg, 'PID', 3);
ids[0]?.[0]?.[0]  // → 'MRN123'      (first identifier value)
ids[0]?.[3]?.[0]  // → 'HOSPITAL'    (assigning authority, 0-indexed)
ids[1]?.[0]?.[0]  // → 'SSN456'      (second identifier value)
```

---

### Typed segment helpers

Import from `hl7v2/segments`. Each class wraps a raw `HL7Segment` and exposes named, documented accessor methods.

```typescript
import { parse, segment, segments } from '@pritiranjan/hl7v2';
import { MSH, PID, PV1, OBX } from '@pritiranjan/hl7v2/segments';

const msg = parse(raw);

// MSH — Message Header
const msh = new MSH(segment(msg, 'MSH'), msg.encoding);
msh.sendingApplication()           // 'HOSPITAL_ADT'
msh.messageType()                  // { type: 'ADT', event: 'A01', structure: 'ADT_A01' }
msh.messageControlId()             // 'MSG000001'
msh.version()                      // '2.5.1'
msh.processingId()                 // 'P'

// PID — Patient Identification
const pid = new PID(segment(msg, 'PID'), msg.encoding);
pid.patientName()
// → { family: 'Doe', given: 'John', middle: 'A', suffix: 'Jr', prefix: 'Mr', degree: 'MD' }
pid.patientIdentifiers()
// → [{ id: 'MRN123', assigningAuthority: 'HOSPITAL', identifierTypeCode: 'MR' }]
pid.dateOfBirth()                  // Date | undefined
pid.sex()                          // 'M' | 'F' | 'O' | 'U' | ...
pid.address()
// → { streetAddress: '123 Main St', city: 'Boston', state: 'MA', postalCode: '02101', ... }

// PV1 — Patient Visit
const pv1 = new PV1(segment(msg, 'PV1'), msg.encoding);
pv1.patientClass()                 // 'I' (Inpatient)
pv1.assignedLocation()
// → { pointOfCare: 'CARDIOLOGY', room: '4A', bed: '101', facility: 'HOSPITAL' }
pv1.attendingDoctor()
// → { id: '1234567', family: 'Smith', given: 'Richard', credential: 'MD' }
pv1.admitDateTime()                // Date | undefined

// OBX — Observation / Lab Result
const obxList = segments(msg, 'OBX').map(s => new OBX(s, msg.encoding));
const obx = obxList[0]!;
obx.observationIdentifier()
// → { code: '718-7', description: 'Hemoglobin [Mass/volume] in Blood', codingSystem: 'LN' }
obx.numericValue()                 // 13.5 (only when valueType() === 'NM')
obx.units()                        // 'g/dL'
obx.referenceRange()               // '13.5-17.5'
obx.abnormalFlags()                // ['H'] | ['HH'] | ['N'] | []
obx.resultStatus()                 // 'F' | 'P' | 'C' | ...
obx.isFinal()                      // true
obx.isCritical()                   // false  (true for HH or LL flags)
```

**Additional typed segments** added in v0.2.0:

| Segment | Description | Key accessors |
|---------|-------------|---------------|
| `EVN` | Event type | `eventTypeCode()`, `recordedDateTime()`, `operatorId()` |
| `MSA` | Message acknowledgement | `acknowledgementCode()`, `messageControlId()`, `isAccepted()`, `isError()` |
| `ORC` | Common order | `orderControl()`, `orderStatus()`, `orderingProvider()`, `callBackPhoneNumber()` |
| `OBR` | Observation request | `universalServiceIdentifier()`, `orderingProvider()`, `resultStatus()`, `isFinal()`, `diagnosticServiceSectionId()` |
| `DG1` | Diagnosis | `diagnosisCode()`, `diagnosisType()`, `isPrincipal()`, `isFinal()` |
| `NK1` | Next of kin | `name()`, `relationship()`, `address()`, `startDate()`, `sex()`, `dateOfBirth()` |

```typescript
import { parse, segment, segments } from '@pritiranjan/hl7v2';
import { EVN, MSA, ORC, OBR, DG1, NK1 } from '@pritiranjan/hl7v2/segments';

// EVN — Event type (ADT messages)
const evn = new EVN(segment(msg, 'EVN'), msg.encoding);
evn.eventTypeCode()           // 'A01'
evn.recordedDateTime()        // Date | undefined
evn.operatorId()              // 'OP123'

// MSA — Message acknowledgement
const msa = new MSA(segment(ackMsg, 'MSA'), ackMsg.encoding);
msa.acknowledgementCode()     // 'AA' | 'AE' | 'AR'
msa.messageControlId()        // 'MSG000001'
msa.isAccepted()              // true when code === 'AA'
msa.isError()                 // true when code === 'AE'

// ORC — Common order header
const orc = new ORC(segment(msg, 'ORC'), msg.encoding);
orc.orderControl()            // 'NW' | 'CA' | 'SC' | ...
orc.orderStatus()             // 'IP' | 'CM' | 'CA' | ...
orc.orderingProvider()        // { id, family, given, credential }
orc.callBackPhoneNumber()     // '555-123-4567'

// OBR — Observation request (ORU messages)
const obr = new OBR(segment(msg, 'OBR'), msg.encoding);
obr.universalServiceIdentifier()
// → { code: '24323-8', description: 'Comprehensive metabolic panel', codingSystem: 'LN' }
obr.orderingProvider()        // { id, family, given, credential }
obr.resultStatus()            // 'F' | 'P' | 'C' | 'I' | ...
obr.isFinal()                 // true
obr.diagnosticServiceSectionId() // 'CH' | 'HM' | 'MB' | 'RAD' | ...

// DG1 — Diagnosis (may repeat)
const diagnoses = segments(msg, 'DG1').map(s => new DG1(s, msg.encoding));
diagnoses[0]?.diagnosisCode()
// → { code: 'J18.9', description: 'Pneumonia unspecified', codingSystem: 'I10' }
diagnoses[0]?.diagnosisType()    // 'A' (Admitting) | 'W' (Working) | 'F' (Final)
diagnoses[0]?.isPrincipal()      // true when type === 'A' or priority === 1
diagnoses[0]?.diagnosisDateTime() // Date | undefined

// NK1 — Next of kin (may repeat)
const contacts = segments(msg, 'NK1').map(s => new NK1(s, msg.encoding));
contacts[0]?.name()           // { family: 'Doe', given: 'Jane', middle: 'M', ... }
contacts[0]?.relationship()   // { code: 'SPO', description: 'Spouse' }
contacts[0]?.address()        // { streetAddress, city, state, postalCode, country }
contacts[0]?.startDate()      // Date | undefined
contacts[0]?.sex()            // 'F' | 'M' | ...
contacts[0]?.dateOfBirth()    // Date | undefined
```

---

### Message builder

`HL7Builder` constructs HL7 v2 messages from scratch with a fluent API.
It auto-generates a valid MSH segment and accepts raw segment strings appended in order.

```typescript
import { HL7Builder } from '@pritiranjan/hl7v2';

const msg = new HL7Builder('ADT', 'A01', {
  sendingApplication:   'EHR_SYSTEM',
  sendingFacility:      'MAIN_CAMPUS',
  receivingApplication: 'BILLING',
  receivingFacility:    'BILLING_FAC',
  version:              '2.5.1',
  processingId:         'P',
  messageControlId:     'MSG20240315001',  // auto-generated if omitted
})
  .addSegment('EVN|A01|20240315143022')
  .addSegment('PID|1||MRN123^^^HOSP^MR||DOE^JOHN^A||19800305|M')
  .addSegment('PV1|1|I|ICU^3^A')
  .build();

msg.messageType    // { type: 'ADT', event: 'A01', structure: undefined }
msg.version        // '2.5.1'
msg.segments       // [MSH, EVN, PID, PV1]
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `sendingApplication` | `string` | `''` | MSH.3 |
| `sendingFacility` | `string` | `''` | MSH.4 |
| `receivingApplication` | `string` | `''` | MSH.5 |
| `receivingFacility` | `string` | `''` | MSH.6 |
| `version` | `string` | `'2.5'` | MSH.12 — HL7 version |
| `processingId` | `'P'\|'D'\|'T'` | `'P'` | MSH.11 |
| `messageControlId` | `string` | auto (timestamp) | MSH.10 |
| `encoding` | `EncodingChars` | `\|^~\&` | Override if non-standard |
| `lineEnding` | `'\r'\|'\n'\|'\r\n'` | `'\r'` | Segment separator |

Use `toString()` to get the raw string without parsing:

```typescript
const raw = builder.toString()
// 'MSH|^~\&|EHR||BILLING||20240315143022||ADT^A01|MSG001|P|2.5.1\rPID|1||MRN123'
```

---

### Escape sequences

```typescript
import { decodeEscapes, encodeEscapes } from '@pritiranjan/hl7v2';
import { DEFAULT_ENCODING } from '@pritiranjan/hl7v2';

// Decode HL7 escape sequences to their plain-text equivalents
decodeEscapes('Dr\\S\\Smith', DEFAULT_ENCODING)   // 'Dr^Smith'
decodeEscapes('line1\\.br\\line2', DEFAULT_ENCODING) // 'line1\nline2'
decodeEscapes('\\X48656c6c6f\\', DEFAULT_ENCODING)  // 'Hello'

// Encode a plain string for safe inclusion in an HL7 field
encodeEscapes('value|with^seps', DEFAULT_ENCODING) // 'value\\F\\with\\S\\seps'
```

Supported sequences: `\F\`, `\S\`, `\T\`, `\R\`, `\E\`, `\H\`, `\N\`, `\.br\`, `\Xhh...\`.

---

### Date / time utilities

```typescript
import { parseHL7DateTime, formatHL7DateTime, formatHL7Date } from '@pritiranjan/hl7v2';

// Parse any HL7 date/time format → Date in UTC
parseHL7DateTime('20240315143022')         // Date: 2024-03-15 14:30:22 UTC
parseHL7DateTime('20240315143022.456')     // with milliseconds
parseHL7DateTime('20240315143022+0530')    // with timezone offset → UTC
parseHL7DateTime('20240315')              // date-only → midnight UTC
parseHL7DateTime('')                      // → undefined (empty = absent)

// Format a Date to HL7 strings
formatHL7DateTime(new Date())   // '20240315143022'
formatHL7Date(new Date())       // '20240315'
```

---

### ACK generation

```typescript
function createAck(inbound: HL7Message, code: AckCode, options?: AckOptions): string
```

Generate a valid HL7 ACK message from any parsed inbound message. The function:
- Swaps sender and receiver in MSH so the ACK routes back to the originator
- Sets `MSH.9` to `ACK` and generates a new `MSH.10` control ID
- Mirrors version, processing ID, and encoding characters from the inbound message
- Appends an `MSA` segment with the acknowledgement code and original control ID

```typescript
import { parse, createAck } from '@pritiranjan/hl7v2';

const msg = parse(rawMessage);

const accept = createAck(msg, 'AA');
// MSH|^~\&|RecvApp|RecvFac|SendApp|SendFac|20240315143022||ACK|ACK20240315143022|P|2.5.1
// MSA|AA|MSG000001

const reject = createAck(msg, 'AR', { text: 'Duplicate message control ID' });
// MSH|^~\&|RecvApp|RecvFac|SendApp|SendFac|20240315143022||ACK|ACK20240315143022|P|2.5.1
// MSA|AR|MSG000001|Duplicate message control ID
```

**`AckCode`** — `'AA'` (Application Accept) | `'AE'` (Application Error) | `'AR'` (Application Reject)

**`AckOptions`**

| Option | Type | Description |
|---|---|---|
| `text` | `string` | Free-text note placed in `MSA.3`. Omit to leave `MSA.3` empty. |
| `messageControlId` | `string` | Override the generated `MSH.10`. Defaults to `ACK` + timestamp. |

---

### MLLP transport

MLLP (Minimal Lower Layer Protocol) is the standard TCP framing used in clinical environments. Every HL7 v2 interface engine speaks it — Epic, Cerner, Mirth Connect, Rhapsody, and Azure Health Data Services all send and receive MLLP frames.

```typescript
import { MllpServer, MllpClient, frame, unframe } from '@pritiranjan/hl7v2/mllp';
```

> **Node.js only** — this sub-path uses `node:net` and is not available in browser bundles.

#### Framing utilities

```typescript
function frame(message: string): Buffer
function unframe(buffer: Buffer): { messages: string[]; remainder: Buffer }
```

Use these when you manage sockets yourself (Lambda, Bun, Deno, custom TCP handlers).

```typescript
import { frame, unframe } from '@pritiranjan/hl7v2/mllp';
import { encode } from '@pritiranjan/hl7v2';

// Wrap a message for transmission
const packet = frame(encode(msg));
socket.write(packet);

// Parse incoming data stream (TCP may split or combine frames)
let buf = Buffer.alloc(0);
socket.on('data', chunk => {
  buf = Buffer.concat([buf, chunk]);
  const { messages, remainder } = unframe(buf);
  buf = remainder;
  for (const raw of messages) handle(raw);
});
```

#### MllpServer

Listen for inbound MLLP connections. Each decoded message is emitted with an `ack` callback — call it to send the response.

```typescript
import { parse, createAck } from '@pritiranjan/hl7v2';
import { MllpServer } from '@pritiranjan/hl7v2/mllp';

const server = new MllpServer({ port: 2575 });

server.on('message', (raw, ack) => {
  const msg = parse(raw);
  console.log(`Received ${msg.messageType.type} ${msg.messageControlId}`);
  ack(createAck(msg, 'AA'));
});

server.on('error', err => console.error('MLLP error:', err));

await server.listen();
console.log(`Listening on port ${server.address?.port}`);

// Graceful shutdown
process.on('SIGTERM', () => server.close());
```

**`MllpServerOptions`**

| Option | Type | Default | Description |
|---|---|---|---|
| `port` | `number` | — | TCP port. Pass `0` to let the OS pick a free port. |
| `host` | `string` | all interfaces | Network interface to bind. |
| `socketTimeout` | `number` | `0` (disabled) | Milliseconds of inactivity before forcibly closing a client socket. |

#### MllpClient

Send MLLP-framed messages to a remote server and receive the ACK.

```typescript
import { encode } from '@pritiranjan/hl7v2';
import { MllpClient } from '@pritiranjan/hl7v2/mllp';

const client = new MllpClient({ host: '10.0.1.42', port: 2575 });
await client.connect();

const ackRaw = await client.send(encode(outboundMsg));
console.log('ACK received:', ackRaw);

await client.close();
```

Responses are matched to sends in FIFO order, which is the behaviour mandated by the MLLP specification. The client maintains a single persistent connection — reconnect by calling `close()` then `connect()` again.

**`MllpClientOptions`**

| Option | Type | Default | Description |
|---|---|---|---|
| `host` | `string` | — | Remote MLLP server hostname or IP. |
| `port` | `number` | — | Remote MLLP server port. |
| `connectTimeout` | `number` | `10 000` | TCP connection timeout in ms. |
| `responseTimeout` | `number` | `30 000` | Per-message ACK wait timeout in ms. |

---

## HL7Message structure

```typescript
interface HL7Message {
  version:              string;        // '2.5.1'
  messageType:          MessageType;   // { type: 'ADT', event: 'A01', structure: 'ADT_A01' }
  messageControlId:     string;        // 'MSG000001'
  timestamp:            Date | undefined;
  sendingApplication:   string;        // MSH.3
  sendingFacility:      string;        // MSH.4
  receivingApplication: string;        // MSH.5
  receivingFacility:    string;        // MSH.6
  processingId:         string;        // 'P' | 'D' | 'T'
  segments:             HL7Segment[];
  encoding:             EncodingChars;
  raw:                  string;        // original input, trimmed
  lineEnding:           '\r' | '\n' | '\r\n';
}

// A segment field: [repetition][component][subComponent]
type HL7Field = string[][][];
```

---

## Real-world examples

### Parse a lab result and alert on critical values

```typescript
import { parse, segments } from '@pritiranjan/hl7v2';
import { OBX } from '@pritiranjan/hl7v2/segments';

function findCriticalResults(rawMessage: string) {
  const msg = parse(rawMessage);
  return segments(msg, 'OBX')
    .map(s => new OBX(s, msg.encoding))
    .filter(obx => obx.isCritical())
    .map(obx => ({
      code:        obx.observationIdentifier().code,
      description: obx.observationIdentifier().description,
      value:       obx.observationValue(),
      units:       obx.units(),
      flag:        obx.primaryAbnormalFlag(),
    }));
}
```

### Build an ACK response

```typescript
import { parse, createAck } from '@pritiranjan/hl7v2';

function buildAck(rawMessage: string, ackCode: 'AA' | 'AE' | 'AR'): string {
  return createAck(parse(rawMessage), ackCode);
}
```

### Extract all patient identifiers

```typescript
import { parse, getRepetitions } from '@pritiranjan/hl7v2';

function getPatientIds(rawMessage: string) {
  const msg = parse(rawMessage);
  return getRepetitions(msg, 'PID', 3).map(rep => ({
    id:                rep[0]?.[0] ?? '',
    assigningAuthority: rep[3]?.[0] ?? '',
    typeCode:          rep[4]?.[0] ?? '',
  }));
}
```

---

## Live demo

An interactive React demo is deployed at **https://hl7v2-react.vercel.app**.

Paste any HL7 v2.x message (ADT, ORU, ORM, or your own) into the left panel and see it parsed into structured cards in real time — patient identity, visit details, lab results with flag highlighting, and more. Source: [hkpritiranjan/hl7v2-react](https://github.com/hkpritiranjan/hl7v2-react).

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, coding conventions, and the pull request process.

---

## License

MIT © [Pritiranjan Swain](https://github.com/hkpritiranjan)
