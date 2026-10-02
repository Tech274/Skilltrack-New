/** Vendor brand tokens for marketplace / featured cert cards. Official pack logos under /logos/oem/. */
export type VendorBrand = {
  color: string;
  shortLabel: string;
  localSrc?: string;
  /** simpleicons slug when no official pack file */
  simpleIcon?: string;
  /** wordmark → wider well (~96×40); mark → square (~48) */
  logoLayout?: "wordmark" | "mark";
};

/** Match Certification.vendor strings from src/lib/certifications.ts */
export const VENDOR_BRANDS: Record<string, VendorBrand> = {
  "Amazon Web Services": {
    color: "#FF9900",
    shortLabel: "AWS",
    localSrc: "/logos/oem/aws.svg",
    logoLayout: "wordmark",
  },
  Microsoft: {
    color: "#0078D4",
    shortLabel: "Microsoft",
    localSrc: "/logos/oem/azure.svg",
    logoLayout: "mark",
  },
  "Google Cloud": {
    color: "#4285F4",
    shortLabel: "Google Cloud",
    localSrc: "/logos/oem/gcp.svg",
    logoLayout: "wordmark",
  },
  "CNCF / Linux Foundation": {
    color: "#326CE5",
    shortLabel: "CNCF",
    localSrc: "/logos/oem/kubernetes.svg",
    logoLayout: "mark",
  },
  HashiCorp: {
    color: "#7B42BC",
    shortLabel: "HashiCorp",
    localSrc: "/logos/oem/hashicorp.png",
    logoLayout: "mark",
  },
  ISC2: {
    color: "#F16B24",
    shortLabel: "ISC2",
    localSrc: "/logos/oem/isc2.svg",
    logoLayout: "mark",
  },
  CompTIA: {
    color: "#E31837",
    shortLabel: "CompTIA",
    localSrc: "/logos/oem/comptia.png",
    logoLayout: "wordmark",
  },
  Snowflake: {
    color: "#29B5E8",
    shortLabel: "Snowflake",
    localSrc: "/logos/oem/snowflake-bug.svg",
    logoLayout: "mark",
  },
  Databricks: {
    color: "#FF3621",
    shortLabel: "Databricks",
    localSrc: "/logos/oem/databricks.png",
    logoLayout: "mark",
  },
  Salesforce: {
    color: "#00A1E0",
    shortLabel: "Salesforce",
    localSrc: "/logos/oem/salesforce.png",
    logoLayout: "wordmark",
  },
  ServiceNow: {
    color: "#62D84E",
    shortLabel: "ServiceNow",
    localSrc: "/logos/oem/servicenow.svg",
    logoLayout: "wordmark",
  },
};

export function brandForVendor(vendor: string): VendorBrand {
  return (
    VENDOR_BRANDS[vendor] ?? {
      color: "#64748B",
      shortLabel: vendor,
      logoLayout: "mark",
    }
  );
}
