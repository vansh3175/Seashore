
// [FIX] The import below causes the error because 'prisma/config' only exists in Prisma v6+.
// Since you downgraded, we must disable this new configuration method.

// import { defineConfig } from "prisma/config"; 

import "dotenv/config";

// If you were using this to set the schema path, Prisma v5 automatically looks 
// in `prisma/schema.prisma`. You usually don't need this file in v5.
const config = {
  // schema: "prisma/schema.prisma", 
};

export default config;