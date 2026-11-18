import type { CategoryId } from "./categories";
export const personality: Record<
  CategoryId,
  {
    headline: string;
    punchline: string;
    description: string;
    title: string;
    quotes: string[];
  }
> = {
  boats: {
    headline: "Buy a boat.",
    punchline: "Blame the duck.",
    description:
      "For the person who looked at a perfectly good bank account and thought: needs more boat.",
    title: "CAPTAIN OF ACQUISITIONS",
    quotes: [
      "Have you considered becoming a boat person? Very normal. Very affordable. Allegedly.",
      "A boat is just a house that has commitment issues.",
      "I have reviewed your requirements. They say “boat.” Excellent brief.",
      "My qualifications? I float.",
      "I cannot parallel park a boat. This has not affected my confidence.",
    ],
  },
  compute: {
    headline: "More GPUs.",
    punchline: "Fewer excuses.",
    description:
      "A 5090. A 128GB Spark. Something to turn “I could run that locally” into a personality.",
    title: "CHIEF HEAT GENERATOR",
    quotes: [
      "It is not a space heater. It is infrastructure.",
      "128GB of memory. Still cannot remember why I walked into this room.",
      "Your next model deserves a home. Your desk can negotiate.",
      "Have you tried adding another GPU?",
      "The fan noise is the sound of ambition.",
    ],
  },
  pokemon: {
    headline: "Gotta find",
    punchline: "that box.",
    description:
      "For your sealed collection. Which will definitely stay sealed. This time.",
    title: "HEAD OF CARDBOARD",
    quotes: [
      "You said “last box” three boxes ago. I am a duck, not a judge.",
      "The real rare pull is a reasonable price.",
      "Schrödinger’s box: both a great pull and a terrible pull until opened.",
      "A shelf full of sealed boxes is technically interior design.",
      "I collect breadcrumbs. Similar hobby. Different margins.",
    ],
  },
  ducks: {
    headline: "Dream big.",
    punchline: "Duck bigger.",
    description:
      "A six-foot rubber duck is a problem. Not owning one is also a problem. We solve the second one.",
    title: "DIRECTOR OF DUCK PROCUREMENT",
    quotes: [
      "Finally. A sensible purchase.",
      "Measure the door. Trust me on this one.",
      "Your HOA has not prepared for this.",
      "If it fits in the cart, it fits in your life. Probably.",
      "This meeting could have been a giant duck.",
    ],
  },
};
export const surpriseMissions: {
  category: CategoryId;
  option: number;
  name: string;
}[] = [
  {
    category: "ducks",
    option: 2,
    name: "Become a local landmark. Six-foot duck edition.",
  },
  {
    category: "compute",
    option: 0,
    name: "Put a tiny supercomputer on the desk. Act casual.",
  },
  {
    category: "boats",
    option: 4,
    name: "Acquire a house with questionable foundations. Water.",
  },
  {
    category: "pokemon",
    option: 2,
    name: "Buy cardboard. Experience emotions.",
  },
  {
    category: "ducks",
    option: 3,
    name: "Dress for the job you want: enormous duck.",
  },
  {
    category: "boats",
    option: 5,
    name: "Borrow the yacht lifestyle for one afternoon.",
  },
  {
    category: "compute",
    option: 1,
    name: "Give the electricity meter a new hobby.",
  },
  {
    category: "ducks",
    option: 1,
    name: "Upgrade from pool guest to pool management.",
  },
];
