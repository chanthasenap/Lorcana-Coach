import "dotenv/config";
import { seedDemoData } from "../src/db/seed";

seedDemoData()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
