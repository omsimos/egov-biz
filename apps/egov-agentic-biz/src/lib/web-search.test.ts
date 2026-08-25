import { describe, expect, test } from "bun:test";
import { isOfficialSource, officialSourcesFrom } from "./web-search";

describe("isOfficialSource", () => {
  test("accepts gov.ph hosts and subdomains", () => {
    expect(isOfficialSource("https://www.bir.gov.ph/index.php")).toBe(true);
    expect(isOfficialSource("https://bnrs.dti.gov.ph/registration")).toBe(true);
    expect(isOfficialSource("https://gov.ph")).toBe(true);
  });

  test("rejects non-government hosts", () => {
    expect(isOfficialSource("https://example.com/bir")).toBe(false);
    expect(isOfficialSource("not a url")).toBe(false);
  });

  // The previous implementation matched ".gov.ph" anywhere in the URL string, so
  // a path or query segment was enough to pass as official.
  test("rejects gov.ph appearing outside the hostname", () => {
    expect(isOfficialSource("https://evil.example.com/?to=bir.gov.ph")).toBe(false);
    expect(isOfficialSource("https://evil.example.com/dti.gov.ph/permit")).toBe(false);
  });

  test("rejects a host that merely ends in a similar string", () => {
    expect(isOfficialSource("https://notgov.ph/permit")).toBe(false);
  });
});

describe("officialSourcesFrom", () => {
  test("keeps official results, drops the rest, and dedupes by url", () => {
    expect(
      officialSourcesFrom([
        { title: "BIR RDO list", url: "https://bir.gov.ph/rdo" },
        { title: "Blog copy", url: "https://medium.com/bir-rdo" },
        { title: "BIR RDO list again", url: "https://bir.gov.ph/rdo" },
        { title: "DTI names", url: "https://bnrs.dti.gov.ph/names" },
      ]),
    ).toEqual([
      { title: "BIR RDO list", url: "https://bir.gov.ph/rdo" },
      { title: "DTI names", url: "https://bnrs.dti.gov.ph/names" },
    ]);
  });

  test("skips entries missing a usable title or url", () => {
    expect(
      officialSourcesFrom([
        { title: "   ", url: "https://bir.gov.ph/a" },
        { title: "No url" },
        { url: "https://bir.gov.ph/b" },
        { title: 42, url: "https://bir.gov.ph/c" },
      ]),
    ).toEqual([]);
  });

  test("honours the limit", () => {
    const many = Array.from({ length: 8 }, (_, index) => ({
      title: `Page ${index}`,
      url: `https://bir.gov.ph/${index}`,
    }));
    expect(officialSourcesFrom(many, 3)).toHaveLength(3);
    expect(officialSourcesFrom(many)).toHaveLength(5);
  });
});
