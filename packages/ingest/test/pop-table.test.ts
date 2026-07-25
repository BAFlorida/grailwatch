import { describe, expect, it } from "vitest";
import { parseGradePopTable } from "../src/pop-table";

const PSA_STYLE = `
<html><body>
<h1>Some Card — Pop Report</h1>
<table>
  <tr><th>Variety</th><th>10</th><th>9</th><th>8</th><th>7</th><th>6</th><th>TOTAL</th></tr>
  <tr><td>Base</td><td>12</td><td>240</td><td>510</td><td>402</td><td>140</td><td>1,304</td></tr>
  <tr><td>TOTAL POP</td><td>14</td><td>261</td><td>544</td><td>431</td><td>150</td><td>1,400</td></tr>
</table>
</body></html>`;

const CGC_STYLE = `
<html><body>
<table>
  <tr><td></td><td>9.8</td><td>9.6</td><td>9.2</td><td>6.5</td><td>4.0</td></tr>
  <tr><td>Universal</td><td>51</td><td>87</td><td>215</td><td>402</td><td>318</td></tr>
</table>
</body></html>`;

describe("parseGradePopTable", () => {
  it("parses a PSA-style table, preferring the TOTAL row", () => {
    const result = parseGradePopTable(PSA_STYLE, "psa");
    expect(result).toEqual({
      psa_10: 14,
      psa_9: 261,
      psa_8: 544,
      psa_7: 431,
      psa_6: 150,
    });
  });

  it("parses a CGC-style table with decimal grades", () => {
    const result = parseGradePopTable(CGC_STYLE, "cgc");
    expect(result).toEqual({
      cgc_9_8: 51,
      cgc_9_6: 87,
      cgc_9_2: 215,
      cgc_6_5: 402,
      cgc_4_0: 318,
    });
  });

  it("returns {} for pages without a recognizable pop table", () => {
    expect(parseGradePopTable("<html><body><p>maintenance</p></body></html>", "psa")).toEqual({});
    expect(
      parseGradePopTable(
        "<table><tr><th>Name</th><th>Price</th></tr><tr><td>x</td><td>1</td></tr></table>",
        "psa",
      ),
    ).toEqual({});
  });
});
