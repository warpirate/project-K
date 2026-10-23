import type { LucideIcon } from "lucide-react";
import {
  Baby,
  BatteryCharging,
  Cable,
  Coffee,
  Cookie,
  Croissant,
  CupSoda,
  Droplets,
  Egg,
  Frame,
  Hammer,
  Headphones,
  Hotel,
  Lightbulb,
  Milk,
  Monitor,
  Package,
  Paintbrush,
  Pencil,
  Pill,
  Scissors,
  Shirt,
  ShoppingBag,
  ShoppingBasket,
  SprayCan,
  Store,
  Video,
  Wheat,
  Wrench,
  BadgeIndianRupee,
  Camera,
  Car,
  Copy,
  CreditCard,
  Droplet,
  Fingerprint,
  Flame,
  GraduationCap,
  HeartPulse,
  IdCard,
  IndianRupee,
  Layers,
  Phone,
  PiggyBank,
  Plane,
  PlugZap,
  QrCode,
  Satellite,
  ShieldCheck,
  Smartphone,
  Ticket,
  Tv,
  Wifi,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  Banknote,
  FileText,
  HandCoins,
  Landmark,
  Printer,
  Receipt,
  Scale,
  Send,
  Undo2,
  Wallet,
  Zap,
} from "lucide-react";
import type { Flow } from "@/lib/rules";
import { cx } from "./ui";

/** One picture per kind of money place, so cash / wallet / bank are told apart at a glance. */
export const ACCOUNT_ICON: Record<"cash" | "wallet" | "bank", LucideIcon> = {
  cash: Banknote,
  wallet: Wallet,
  bank: Landmark,
};

/** One picture per service type. */
export const FLOW_ICON: Record<Flow, LucideIcon> = {
  cash_out: HandCoins,
  cash_in: Send,
  pay_through: Zap,
  application: FileText,
  counter_sale: ShoppingBag,
};

/** One picture per non-service entry. */
export const KIND_ICON: Record<string, LucideIcon> = {
  expense: Receipt,
  transfer: ArrowLeftRight,
  udhaar_payment: ArrowDownToLine,
  udhaar_given: ArrowUpFromLine,
  opening_balance: Scale,
  reversal: Undo2,
};

type Tone = "in" | "out" | "plain" | "accent";

const tones: Record<Tone, string> = {
  in: "bg-accent-soft text-in",
  out: "bg-danger-soft text-out",
  plain: "bg-paper text-ink-soft",
  accent: "bg-accent-soft text-accent",
};

/** Small rounded tile holding an icon, used at the start of list rows. */
export function IconTile({ icon: Icon, tone = "plain", size = "md" }: { icon: LucideIcon; tone?: Tone; size?: "sm" | "md" }) {
  return (
    <span
      aria-hidden
      className={cx("inline-flex shrink-0 items-center justify-center rounded-xl", size === "sm" ? "size-8" : "size-10", tones[tone])}
    >
      <Icon size={size === "sm" ? 16 : 19} strokeWidth={1.9} />
    </span>
  );
}

/** A colour family per picture, readable on light and dark backgrounds. */
const HUES = {
  green: "bg-[#16a34a]/12 text-[#15803d] dark:text-[#4ade80]",
  blue: "bg-[#2563eb]/12 text-[#1d4ed8] dark:text-[#60a5fa]",
  orange: "bg-[#ea580c]/12 text-[#c2410c] dark:text-[#fb923c]",
  red: "bg-[#dc2626]/12 text-[#b91c1c] dark:text-[#f87171]",
  purple: "bg-[#7c3aed]/12 text-[#6d28d9] dark:text-[#a78bfa]",
  teal: "bg-[#0d9488]/12 text-[#0f766e] dark:text-[#2dd4bf]",
  pink: "bg-[#db2777]/12 text-[#be185d] dark:text-[#f472b6]",
  amber: "bg-[#d97706]/14 text-[#b45309] dark:text-[#fbbf24]",
} as const;
type Hue = keyof typeof HUES;

/** Words in a service name → its picture. First match wins, so specific words come first. */
const SERVICE_RULES: [RegExp, LucideIcon, Hue][] = [
  [/data cable|usb|otg|charger|power ?bank/, Cable, "teal"],
  [/earphone|headphone|neckband|tws|speaker|earbud/, Headphones, "purple"],
  [/repair|flashing|unlock|screen change|battery change|charging port|combo/, Wrench, "orange"],
  [/upi.*(cash|atm)|qr|upi atm/, QrCode, "blue"],
  [/aeps|aadhaar pay|micro ?atm|withdraw/, Fingerprint, "blue"],
  [/aadha?ar/, Fingerprint, "purple"],
  [/dmt|money transfer|transfer|send money|remit/, IndianRupee, "green"],
  [/deposit/, PiggyBank, "green"],
  [/mobile|prepaid|postpaid|jio|airtel|\bvi\b|bsnl/, Smartphone, "blue"],
  [/dth|tata play|dish|sun direct/, Satellite, "orange"],
  [/broadband|wifi|internet/, Wifi, "orange"],
  [/landline|telephone/, Phone, "teal"],
  [/electric|current|power|light bill/, PlugZap, "red"],
  [/water/, Droplet, "blue"],
  [/lpg|gas|cylinder/, Flame, "red"],
  [/fastag|vehicle|challan/, Car, "amber"],
  [/insurance|\blic\b|policy/, ShieldCheck, "pink"],
  [/loan|\bemi\b/, BadgeIndianRupee, "amber"],
  [/credit card|cc bill|card bill/, CreditCard, "purple"],
  [/\bpan\b|pan card|voter|ration|certificate|license|passport(?! photo)/, IdCard, "purple"],
  [/education|fee|school|college|exam|admit/, GraduationCap, "orange"],
  [/hospital|health|ayushman/, HeartPulse, "red"],
  [/ticket|\bbus\b|train|irctc/, Ticket, "teal"],
  [/flight|travel/, Plane, "teal"],
  [/cable|tv/, Tv, "orange"],
  [/photo/, Camera, "pink"],
  [/lamina/, Layers, "teal"],
  [/xerox|zerox|photocopy|copy/, Copy, "amber"],
  [/print/, Printer, "amber"],
  [/hair|shav|beard|trim|thread|wax|facial|bleach|spa|manicure|pedicure|make ?up|mehendi|massage|nail art|clean ?up|d-?tan|draping/, Scissors, "pink"],
  [/stitch|blouse|kurta|shirt|pant|suit|churidar|salwar|lehenga|petticoat|alteration|zip|hem|pico|uniform|frock|sherwani|blazer|gown|nighty|embroider/, Shirt, "purple"],
  [/pipe|taps?|valve|elbow|plumb|faucet|tank|shower|teflon|tee/, Wrench, "blue"],
  [/wire|switch|socket|mcb|bulb|tube ?light|led|holder|fans?|extension|regulator|insulation/, Lightbulb, "amber"],
  [/paint|primer|putty|brush|roller|thinner|emulsion|enamel|sand ?paper/, Paintbrush, "orange"],
  [/screw|nails?|bolt|hammer|plier|spanner|drill|hinge|lock|handle|cement|tools?|measuring tape|binding wire/, Hammer, "amber"],
  [/courier|parcel|speed ?post|registered post|cod|packing|box|bubble|envelope/, Package, "orange"],
  [/diaper|baby/, Baby, "pink"],
  [/tablet|syrup|strips?|capsule|medicine|paracetamol|dolo|cough|ors|antacid|vitamin|ointment|balm|drops|inject|bandage|band-?aid|cotton|thermometer|bp|sugar test|gluco|mask|sanitizer|antiseptic|dettol|savlon|vicks/, Pill, "red"],
  [/milk|curd|paneer|butter|ghee|dahi/, Milk, "blue"],
  [/rice|atta|maida|rava|dal|besan|poha|flour|wheat|sugar|salt|jaggery|gur|chana|moong|masoor|urad|rajma/, Wheat, "amber"],
  [/biscuit|chips|namkeen|chocolate|cookie|snack|candy|toffee|parle|maggi|noodle/, Cookie, "orange"],
  [/cold drink|juice|soda|cola|water bottle|pepsi|coca|sprite|frooti|maaza|thums/, CupSoda, "red"],
  [/tea|coffee|bru|nescafe|chai/, Coffee, "amber"],
  [/soap|shampoo|detergent|washing|surf|dishwash|phenyl|harpic|tooth|colgate|cleaner|vim/, SprayCan, "teal"],
  [/oil/, Droplets, "amber"],
  [/eggs?/, Egg, "amber"],
  [/bread|bun|cake|rusk/, Croissant, "orange"],
  [/agarbatti|camphor|kapoor|diya|pooja|candle|matchbox/, Flame, "orange"],
  [/notebook|register|pens?|pencil|eraser|geometry|chart|file|folder|paper|stapler|calculator|sketch|crayon/, Pencil, "blue"],
  [/frame|album/, Frame, "purple"],
  [/shoot|video|drone|wedding/, Video, "pink"],
  [/hotel/, Hotel, "teal"],
  [/sim|phone/, Smartphone, "blue"],
];

const FLOW_HUE: Record<Flow, Hue> = { cash_out: "blue", cash_in: "green", pay_through: "orange", application: "purple", counter_sale: "amber" };

/** One picture per kind of business, shown on the setup cards. */
export const PACK_LOOK: Record<string, { icon: LucideIcon; hue: string }> = {
  csc: { icon: Monitor, hue: HUES.blue },
  mobile: { icon: Smartphone, hue: HUES.teal },
  salon: { icon: Scissors, hue: HUES.pink },
  tailor: { icon: Shirt, hue: HUES.purple },
  print: { icon: Printer, hue: HUES.amber },
  photo: { icon: Camera, hue: HUES.pink },
  travel: { icon: Plane, hue: HUES.teal },
  courier: { icon: Package, hue: HUES.orange },
  kirana: { icon: ShoppingBasket, hue: HUES.green },
  hardware: { icon: Hammer, hue: HUES.orange },
  medical: { icon: Pill, hue: HUES.red },
  other: { icon: Store, hue: HUES.purple },
};

/** Picture and colour for a service, picked from its name, falling back to its type. */
export function serviceLook(name: string, flow: Flow): { icon: LucideIcon; hue: string } {
  const n = name.toLowerCase();
  const hit = SERVICE_RULES.find(([re]) => re.test(n));
  return hit ? { icon: hit[1], hue: HUES[hit[2]] } : { icon: FLOW_ICON[flow], hue: HUES[FLOW_HUE[flow]] };
}

/** Big tappable service tile: picture on top, name under it (like a portal's service grid). */
export function ServiceGlyph({ name, flow, size = "md" }: { name: string; flow: Flow; size?: "sm" | "md" | "lg" }) {
  const { icon: Icon, hue } = serviceLook(name, flow);
  const box = { sm: "size-8 rounded-xl", md: "size-10 rounded-xl", lg: "size-12 rounded-2xl" }[size];
  return (
    <span aria-hidden className={cx("inline-flex shrink-0 items-center justify-center", box, hue)}>
      <Icon size={{ sm: 16, md: 19, lg: 24 }[size]} strokeWidth={1.9} />
    </span>
  );
}
