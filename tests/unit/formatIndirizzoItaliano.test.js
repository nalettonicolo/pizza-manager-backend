import { describe, it, expect } from "vitest"
import {
  formatIndirizzoLineaItaliana,
  formatIndirizzoFromNominatim,
  formatIndirizzoFromGoogleAddressComponents,
} from "@/utils/formatIndirizzoItaliano"

describe("formatIndirizzoLineaItaliana", () => {
  it("combina strada, civico, città e CAP", () => {
    expect(
      formatIndirizzoLineaItaliana({
        road: "Via Fondà",
        houseNumber: "19a/1",
        city: "Padova",
        postcode: "35124",
      }),
    ).toBe("Via Fondà 19a/1, Padova 35124")
  })
})

describe("formatIndirizzoFromNominatim", () => {
  it("usa address Nominatim", () => {
    expect(
      formatIndirizzoFromNominatim({
        address: {
          road: "Via Guasti",
          house_number: "12",
          city: "Padova",
          postcode: "35124",
        },
        display_name: "12, Via Guasti, Padova, Veneto, 35124, Italia",
      }),
    ).toBe("Via Guasti 12, Padova 35124")
  })

  it("senza address ricade su display_name", () => {
    expect(formatIndirizzoFromNominatim({ display_name: "Roma, RM, Italia" })).toBe("Roma, RM, Italia")
  })
})

describe("formatIndirizzoFromGoogleAddressComponents", () => {
  it("legge longText / long_name", () => {
    const components = [
      { longText: "Via Roma", types: ["route"] },
      { longText: "10", types: ["street_number"] },
      { longText: "35121", types: ["postal_code"] },
      { longText: "Padova", types: ["locality"] },
    ]
    expect(formatIndirizzoFromGoogleAddressComponents(components)).toBe("Via Roma 10, Padova 35121")
  })
})
