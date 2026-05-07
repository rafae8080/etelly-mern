import mongoose from "mongoose";
import dotenv from "dotenv";
import EvacuationCenter from "../models/EvacuationCenter.js";

dotenv.config();

const centers = [
  // Muntindilaw
  { name: "Muntindilaw Elementary School", location: "Brgy. Muntindilaw, Antipolo City", barangay: "muntindilaw", capacity: 300 },
  { name: "Muntindilaw Barangay Hall",      location: "Brgy. Muntindilaw, Antipolo City", barangay: "muntindilaw", capacity: 150 },
  { name: "Muntindilaw Covered Court",      location: "Brgy. Muntindilaw, Antipolo City", barangay: "muntindilaw", capacity: 200 },
  { name: "Muntindilaw Daycare Center",     location: "Brgy. Muntindilaw, Antipolo City", barangay: "muntindilaw", capacity: 80  },

  // Mayamot
  { name: "Mayamot Elementary School",      location: "Brgy. Mayamot, Antipolo City",     barangay: "mayamot",     capacity: 350 },
  { name: "Mayamot Barangay Hall",          location: "Brgy. Mayamot, Antipolo City",     barangay: "mayamot",     capacity: 120 },
  { name: "Mayamot Covered Court",          location: "Brgy. Mayamot, Antipolo City",     barangay: "mayamot",     capacity: 250 },
  { name: "Mayamot Clubhouse",              location: "Brgy. Mayamot, Antipolo City",     barangay: "mayamot",     capacity: 100 },
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  const existing = await EvacuationCenter.countDocuments();
  if (existing > 0) {
    console.log(`Already have ${existing} centers — skipping seed. Delete them first if you want to re-seed.`);
    process.exit(0);
  }

  await EvacuationCenter.insertMany(centers);
  console.log(`Seeded ${centers.length} evacuation centers.`);
  process.exit(0);
}

seed().catch((err) => { console.error(err); process.exit(1); });
