import { describe, it, expect } from "vitest";
import { Copy, Fingerprint, IdCard, IndianRupee, PlugZap, Printer, QrCode, ShieldCheck, Smartphone } from "lucide-react";
import { FLOW_ICON, serviceLook } from "@/components/icons";

describe("serviceLook", () => {
  it("picks a picture from the service name", () => {
    expect(serviceLook("AEPS withdrawal", "cash_out").icon).toBe(Fingerprint);
    expect(serviceLook("UPI to cash", "cash_out").icon).toBe(QrCode);
    expect(serviceLook("Money transfer", "cash_in").icon).toBe(IndianRupee);
    expect(serviceLook("Mobile recharge", "pay_through").icon).toBe(Smartphone);
    expect(serviceLook("Electricity bill", "pay_through").icon).toBe(PlugZap);
    expect(serviceLook("PAN card application", "application").icon).toBe(IdCard);
    expect(serviceLook("LIC premium", "pay_through").icon).toBe(ShieldCheck);
    expect(serviceLook("Xerox", "counter_sale").icon).toBe(Copy);
    expect(serviceLook("Colour print", "counter_sale").icon).toBe(Printer);
  });
  it("does not match words inside other words", () => {
    expect(serviceLook("Online application", "application").icon).toBe(FLOW_ICON.application);
    expect(serviceLook("Spiral binding", "counter_sale").icon).toBe(FLOW_ICON.counter_sale);
  });
});
