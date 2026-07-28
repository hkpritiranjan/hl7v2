import type { EncodingChars, HL7Segment } from '../schema.js';
import { TypedSegment } from './base.js';
import type { Provider } from './pv1.js';

/**
 * ORC.1 — Order Control Codes (HL7 table 0119).
 * Defines what action is being requested or reported.
 */
export type OrderControl =
  | 'NW'   // New order
  | 'CA'   // Cancel order request
  | 'DC'   // Discontinue order request
  | 'HD'   // Hold order request
  | 'RL'   // Release previous hold
  | 'OC'   // Order cancelled (response)
  | 'OK'   // Order accepted (response)
  | 'UA'   // Unable to accept order
  | 'CM'   // Order completed
  | 'RE'   // Observations/Inventory to follow
  | 'RO'   // Replacement order
  | 'RP'   // Order replace request
  | 'SC'   // Status changed
  | 'SN'   // Send order number
  | 'SR'   // Response to send order status request
  | 'SS'   // Send order status request
  | string;

/**
 * ORC.5 — Order Status Codes (HL7 table 0038).
 */
export type OrderStatus =
  | 'A'    // Some, but not all, results available
  | 'CA'   // Order was cancelled
  | 'CM'   // Order is completed
  | 'DC'   // Order was discontinued
  | 'ER'   // Error, order not found
  | 'HD'   // Order is on hold
  | 'IP'   // In process, unspecified
  | 'RP'   // Order has been replaced
  | 'SC'   // In process, scheduled
  | string;

/**
 * Typed accessor for the ORC (Common Order) segment.
 *
 * ORC is present in ORM (order message), OMG, ORU, and ORR messages.
 * It carries the order control code, placer/filler IDs, order status,
 * and the clinician who placed the order.
 *
 * @example
 * import { parse, segment } from '@pritiranjan/hl7v2';
 * import { ORC } from '@pritiranjan/hl7v2/segments';
 *
 * const msg = parse(raw);
 * const orc = new ORC(segment(msg, 'ORC'), msg.encoding);
 *
 * orc.orderControl()       // 'NW' (new order)
 * orc.placerOrderNumber()  // 'ORD-2024-00123'
 * orc.orderStatus()        // 'IP' (in process)
 * orc.orderingProvider()   // { id: '1234567', family: 'Kim', given: 'Sarah', ... }
 */
export class ORC extends TypedSegment {
  constructor(seg: HL7Segment, enc: EncodingChars) {
    super(seg, enc);
  }

  /**
   * ORC.1 — Order Control Code (HL7 table 0119).
   * `'NW'` = new order · `'CA'` = cancel · `'OK'` = accepted · `'CM'` = completed
   */
  orderControl(): OrderControl { return this.str(1); }

  /** ORC.2 — Placer Order Number (assigned by the ordering system). */
  placerOrderNumber(): string { return this.str(2, 1); }

  /** ORC.3 — Filler Order Number (assigned by the lab or fulfilling system). */
  fillerOrderNumber(): string { return this.str(3, 1); }

  /** ORC.4 — Placer Group Number (links related orders together). */
  placerGroupNumber(): string { return this.str(4, 1); }

  /** ORC.5 — Order Status (HL7 table 0038). */
  orderStatus(): OrderStatus { return this.str(5); }

  /** ORC.9 — Date/Time of Transaction — when this ORC segment was created. */
  transactionDateTime(): Date | undefined { return this.date(9); }

  /** ORC.10 — Entered By — the person who entered the order into the system. */
  enteredBy(): Provider {
    return {
      id:         this.str(10, 1),
      family:     this.str(10, 2),
      given:      this.str(10, 3),
      middle:     this.str(10, 4),
      credential: this.str(10, 7),
    };
  }

  /**
   * ORC.12 — Ordering Provider.
   * The clinician responsible for requesting this order.
   */
  orderingProvider(): Provider {
    return {
      id:         this.str(12, 1),
      family:     this.str(12, 2),
      given:      this.str(12, 3),
      middle:     this.str(12, 4),
      credential: this.str(12, 7),
    };
  }

  /** ORC.14 — Call Back Phone Number. */
  callBackPhoneNumber(): string { return this.str(14, 1); }

  /** ORC.15 — Order Effective Date/Time. */
  orderEffectiveDateTime(): Date | undefined { return this.date(15); }

  /** ORC.17 — Entering Organization. */
  enteringOrganization(): string { return this.str(17, 1); }

  /** ORC.21 — Ordering Facility Name. */
  orderingFacilityName(): string { return this.str(21, 1); }
}
