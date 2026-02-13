const fallbackRegions = [
  "US", "GB", "CA", "AU", "DE", "FR", "ES", "IT", "NL", "BE", "CH", "SE", "NO", "DK", "FI", "IE", "PT", "PL", "CZ", "AT", "GR", "TR", "RU", "UA", "RO", "BG", "HU", "HR", "RS", "AL", "BA", "MK", "SI", "SK", "LT", "LV", "EE", "IS", "LU", "MT", "CY", "GE", "AM", "AZ", "KZ", "UZ", "TJ", "KG", "TM", "AF", "PK", "IN", "BD", "LK", "NP", "BT", "MV", "CN", "JP", "KR", "MN", "VN", "TH", "MY", "SG", "ID", "PH", "BN", "KH", "LA", "MM", "TL", "AE", "SA", "QA", "KW", "BH", "OM", "YE", "JO", "LB", "SY", "IQ", "IR", "PS", "EG", "LY", "TN", "DZ", "MA", "SD", "SS", "ET", "ER", "DJ", "SO", "KE", "UG", "TZ", "RW", "BI", "CD", "CG", "CM", "NG", "GH", "CI", "SN", "ML", "NE", "BF", "TG", "BJ", "GM", "GN", "SL", "LR", "GA", "GQ", "AO", "ZM", "ZW", "MW", "MZ", "NA", "BW", "ZA", "LS", "SZ", "MG", "MU", "SC", "KM", "BR", "AR", "CL", "PE", "CO", "VE", "EC", "BO", "PY", "UY", "MX", "GT", "SV", "HN", "NI", "CR", "PA", "CU", "DO", "HT", "JM", "TT", "BS", "BB", "BZ", "NZ", "FJ", "PG", "WS", "TO"
];

function flagFromRegion(code) {
  return code
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt()));
}

function getRegionCodes() {
  if (typeof Intl.supportedValuesOf !== "function") return fallbackRegions;

  try {
    return Intl.supportedValuesOf("region");
  } catch {
    return fallbackRegions;
  }
}

export function getAllCountries() {
  const uniqueRegions = new Set(getRegionCodes().map((code) => code.toUpperCase()));
  uniqueRegions.delete("IL");
  uniqueRegions.add("PS");

  const display = new Intl.DisplayNames(["en"], { type: "region" });

  const countries = Array.from(uniqueRegions)
    .map((code) => ({
      code,
      name: display.of(code) || code,
      flag: flagFromRegion(code)
    }))
    .filter((item) => item.name && item.name !== item.code)
    .sort((a, b) => a.name.localeCompare(b.name, "en"));

  return countries;
}

export const phoneDialCodes = [
  { code: "+1", label: "🇺🇸 +1" },
  { code: "+20", label: "🇪🇬 +20" },
  { code: "+27", label: "🇿🇦 +27" },
  { code: "+30", label: "🇬🇷 +30" },
  { code: "+31", label: "🇳🇱 +31" },
  { code: "+32", label: "🇧🇪 +32" },
  { code: "+33", label: "🇫🇷 +33" },
  { code: "+34", label: "🇪🇸 +34" },
  { code: "+36", label: "🇭🇺 +36" },
  { code: "+39", label: "🇮🇹 +39" },
  { code: "+40", label: "🇷🇴 +40" },
  { code: "+41", label: "🇨🇭 +41" },
  { code: "+43", label: "🇦🇹 +43" },
  { code: "+44", label: "🇬🇧 +44" },
  { code: "+45", label: "🇩🇰 +45" },
  { code: "+46", label: "🇸🇪 +46" },
  { code: "+47", label: "🇳🇴 +47" },
  { code: "+48", label: "🇵🇱 +48" },
  { code: "+49", label: "🇩🇪 +49" },
  { code: "+51", label: "🇵🇪 +51" },
  { code: "+52", label: "🇲🇽 +52" },
  { code: "+53", label: "🇨🇺 +53" },
  { code: "+54", label: "🇦🇷 +54" },
  { code: "+55", label: "🇧🇷 +55" },
  { code: "+56", label: "🇨🇱 +56" },
  { code: "+57", label: "🇨🇴 +57" },
  { code: "+58", label: "🇻🇪 +58" },
  { code: "+60", label: "🇲🇾 +60" },
  { code: "+61", label: "🇦🇺 +61" },
  { code: "+62", label: "🇮🇩 +62" },
  { code: "+63", label: "🇵🇭 +63" },
  { code: "+64", label: "🇳🇿 +64" },
  { code: "+65", label: "🇸🇬 +65" },
  { code: "+66", label: "🇹🇭 +66" },
  { code: "+7", label: "🇷🇺 +7" },
  { code: "+81", label: "🇯🇵 +81" },
  { code: "+82", label: "🇰🇷 +82" },
  { code: "+84", label: "🇻🇳 +84" },
  { code: "+86", label: "🇨🇳 +86" },
  { code: "+90", label: "🇹🇷 +90" },
  { code: "+91", label: "🇮🇳 +91" },
  { code: "+92", label: "🇵🇰 +92" },
  { code: "+93", label: "🇦🇫 +93" },
  { code: "+94", label: "🇱🇰 +94" },
  { code: "+95", label: "🇲🇲 +95" },
  { code: "+98", label: "🇮🇷 +98" },
  { code: "+211", label: "🇸🇸 +211" },
  { code: "+212", label: "🇲🇦 +212" },
  { code: "+213", label: "🇩🇿 +213" },
  { code: "+216", label: "🇹🇳 +216" },
  { code: "+218", label: "🇱🇾 +218" },
  { code: "+220", label: "🇬🇲 +220" },
  { code: "+221", label: "🇸🇳 +221" },
  { code: "+222", label: "🇲🇷 +222" },
  { code: "+223", label: "🇲🇱 +223" },
  { code: "+224", label: "🇬🇳 +224" },
  { code: "+225", label: "🇨🇮 +225" },
  { code: "+226", label: "🇧🇫 +226" },
  { code: "+227", label: "🇳🇪 +227" },
  { code: "+228", label: "🇹🇬 +228" },
  { code: "+229", label: "🇧🇯 +229" },
  { code: "+230", label: "🇲🇺 +230" },
  { code: "+231", label: "🇱🇷 +231" },
  { code: "+232", label: "🇸🇱 +232" },
  { code: "+233", label: "🇬🇭 +233" },
  { code: "+234", label: "🇳🇬 +234" },
  { code: "+235", label: "🇹🇩 +235" },
  { code: "+236", label: "🇨🇫 +236" },
  { code: "+237", label: "🇨🇲 +237" },
  { code: "+238", label: "🇨🇻 +238" },
  { code: "+239", label: "🇸🇹 +239" },
  { code: "+240", label: "🇬🇶 +240" },
  { code: "+241", label: "🇬🇦 +241" },
  { code: "+242", label: "🇨🇬 +242" },
  { code: "+243", label: "🇨🇩 +243" },
  { code: "+244", label: "🇦🇴 +244" },
  { code: "+248", label: "🇸🇨 +248" },
  { code: "+249", label: "🇸🇩 +249" },
  { code: "+250", label: "🇷🇼 +250" },
  { code: "+251", label: "🇪🇹 +251" },
  { code: "+252", label: "🇸🇴 +252" },
  { code: "+253", label: "🇩🇯 +253" },
  { code: "+254", label: "🇰🇪 +254" },
  { code: "+255", label: "🇹🇿 +255" },
  { code: "+256", label: "🇺🇬 +256" },
  { code: "+257", label: "🇧🇮 +257" },
  { code: "+260", label: "🇿🇲 +260" },
  { code: "+261", label: "🇲🇬 +261" },
  { code: "+263", label: "🇿🇼 +263" },
  { code: "+264", label: "🇳🇦 +264" },
  { code: "+265", label: "🇲🇼 +265" },
  { code: "+266", label: "🇱🇸 +266" },
  { code: "+267", label: "🇧🇼 +267" },
  { code: "+268", label: "🇸🇿 +268" },
  { code: "+269", label: "🇰🇲 +269" },
  { code: "+351", label: "🇵🇹 +351" },
  { code: "+352", label: "🇱🇺 +352" },
  { code: "+353", label: "🇮🇪 +353" },
  { code: "+354", label: "🇮🇸 +354" },
  { code: "+355", label: "🇦🇱 +355" },
  { code: "+356", label: "🇲🇹 +356" },
  { code: "+357", label: "🇨🇾 +357" },
  { code: "+358", label: "🇫🇮 +358" },
  { code: "+359", label: "🇧🇬 +359" },
  { code: "+370", label: "🇱🇹 +370" },
  { code: "+371", label: "🇱🇻 +371" },
  { code: "+372", label: "🇪🇪 +372" },
  { code: "+373", label: "🇲🇩 +373" },
  { code: "+374", label: "🇦🇲 +374" },
  { code: "+375", label: "🇧🇾 +375" },
  { code: "+376", label: "🇦🇩 +376" },
  { code: "+377", label: "🇲🇨 +377" },
  { code: "+380", label: "🇺🇦 +380" },
  { code: "+381", label: "🇷🇸 +381" },
  { code: "+382", label: "🇲🇪 +382" },
  { code: "+385", label: "🇭🇷 +385" },
  { code: "+386", label: "🇸🇮 +386" },
  { code: "+387", label: "🇧🇦 +387" },
  { code: "+420", label: "🇨🇿 +420" },
  { code: "+421", label: "🇸🇰 +421" },
  { code: "+423", label: "🇱🇮 +423" },
  { code: "+961", label: "🇱🇧 +961" },
  { code: "+962", label: "🇯🇴 +962" },
  { code: "+963", label: "🇸🇾 +963" },
  { code: "+964", label: "🇮🇶 +964" },
  { code: "+965", label: "🇰🇼 +965" },
  { code: "+966", label: "🇸🇦 +966" },
  { code: "+967", label: "🇾🇪 +967" },
  { code: "+968", label: "🇴🇲 +968" },
  { code: "+970", label: "🇵🇸 +970" },
  { code: "+971", label: "🇦🇪 +971" },
  { code: "+972", label: "(excluded)" },
  { code: "+973", label: "🇧🇭 +973" },
  { code: "+974", label: "🇶🇦 +974" },
  { code: "+975", label: "🇧🇹 +975" },
  { code: "+976", label: "🇲🇳 +976" },
  { code: "+977", label: "🇳🇵 +977" },
  { code: "+992", label: "🇹🇯 +992" },
  { code: "+993", label: "🇹🇲 +993" },
  { code: "+994", label: "🇦🇿 +994" },
  { code: "+995", label: "🇬🇪 +995" },
  { code: "+996", label: "🇰🇬 +996" },
  { code: "+998", label: "🇺🇿 +998" }
].filter((item) => !item.label.includes("excluded"));
