export const categories = [
  {
    id: "boats",
    label: "Boats",
    icon: "⛵",
    hint: "A little vessel. A big adventure.",
    optionLabel: "Boat type",
    options: [
      { label: "Sailboat", query: "A sailboat for sale" },
      { label: "Catalina 30", query: "A Catalina 30 sailboat for sale" },
      { label: "Fishing boat", query: "A fishing boat for sale" },
      { label: "Pontoon boat", query: "A pontoon boat for sale" },
      { label: "Houseboat", query: "A houseboat for sale" },
      {
        label: "Weekend charter",
        query: "A captained boat charter for a weekend",
      },
    ],
    conditions: ["Any condition", "Used", "New"],
    note: "Confirm title, condition, mooring and availability with the seller.",
  },
  {
    id: "compute",
    label: "GPUs & AI computers",
    icon: "🖥️",
    hint: "More compute. Less hunting.",
    optionLabel: "Hardware",
    options: [
      {
        label: "DGX Spark · 128GB computer",
        query:
          "NVIDIA DGX Spark 128GB complete AI computer for sale, not accessories",
      },
      {
        label: "GeForce RTX 5090",
        query:
          "NVIDIA GeForce RTX 5090 graphics card for sale, not a prebuilt PC or accessories",
      },
      {
        label: "GeForce RTX 5080",
        query:
          "NVIDIA GeForce RTX 5080 graphics card for sale, not a prebuilt PC or accessories",
      },
      {
        label: "GeForce RTX 4090",
        query:
          "NVIDIA GeForce RTX 4090 graphics card for sale, not accessories",
      },
      {
        label: "Any NVIDIA GPU",
        query: "NVIDIA graphics card for sale for local AI workloads",
      },
    ],
    conditions: ["Any condition", "New", "Used", "Refurbished"],
    note: "DGX Spark is a complete computer with 128GB unified memory; RTX options are graphics cards.",
  },
  {
    id: "pokemon",
    label: "Pokémon boxes",
    icon: "🃏",
    hint: "Gotta find the right box.",
    optionLabel: "Elite Trainer Box",
    options: [
      {
        label: "Any sealed Elite Trainer Box",
        query:
          "Factory sealed Pokémon TCG Elite Trainer Box for sale, not empty boxes or loose cards",
      },
      {
        label: "Scarlet & Violet—151",
        query:
          "Factory sealed Pokémon TCG Scarlet Violet 151 Elite Trainer Box for sale",
      },
      {
        label: "Prismatic Evolutions",
        query:
          "Factory sealed Pokémon TCG Prismatic Evolutions Elite Trainer Box for sale",
      },
      {
        label: "Pokémon Center edition",
        query:
          "Factory sealed Pokémon Center exclusive Elite Trainer Box for sale",
      },
    ],
    conditions: ["Sealed only", "Any packaging"],
    note: "Sealed and authentic are seller claims until verified. Check the set, language, edition and seller.",
  },
  {
    id: "ducks",
    label: "Giant rubber ducks",
    icon: "🦆",
    hint: "A completely reasonable purchase.",
    optionLabel: "Level of ridiculous",
    options: [
      {
        label: "Giant inflatable rubber duck",
        query: "Giant inflatable yellow rubber duck for sale",
      },
      {
        label: "Ride-on duck pool float",
        query: "Giant ride-on yellow duck pool float for sale",
      },
      {
        label: "Six-foot inflatable duck",
        query: "Six foot tall inflatable yellow rubber duck for sale",
      },
      {
        label: "Inflatable duck costume",
        query: "Adult inflatable yellow duck costume for sale",
      },
    ],
    conditions: ["Any condition", "New", "Used"],
    note: "Check inflated dimensions. “Giant” is doing a lot of work on some listings.",
  },
] as const;
export type CategoryId = (typeof categories)[number]["id"];
