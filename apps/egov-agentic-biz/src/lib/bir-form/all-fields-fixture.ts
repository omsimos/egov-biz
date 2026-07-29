import { z } from "zod";
import {
  bir1901DataSchema,
  bir1905DataSchema,
  type Bir1901Data,
  type Bir1905Data,
} from "@/lib/bir-form/schema";

const TEST_SIGNATURE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAPAAAAA8CAYAAABYfzddAAAC/klEQVR42u2dy23DMAxAFaGXbtGJOmwn6hY9uqcAgRHbkviRRb53K1okscQnUrTiPrZtKwCwJpUhAEBgAEBgAEBgAAQGAAQGAAQGAAQGQGAAQGAAQGAABAYABAYABAYABAZAYABAYABA4CY+v763s58BovARVV6kBTJw4KzMNQICE8C3rTyQGYHJUIvv+ZEYgZeW8+/358GilGthzjYeYTMw8uYI6NdqI2PlUbNloSiTe1RxZFi4qD4CCXxVOnsEtPfK37tdiBjoV9eURe6asXTWnFzv7m+LvNGzcOsYZ5C4ZphIq4A+en+rwJE06rJuHaJLXCN1Cz0zj3cJ1yvvu99Zfaa7bB0y7f/dBdbuFkqDRvu9LYUZzbyWAX3HrYPXwpVK4FdhLTPVVbBqBfNZIHkFj+RaNBa+lbYO0SWuZcFmw/7vRwNa+r6tDSTNbN97rZpZuPW+s0WTcMZinVZg7UnUkkE7cx29npbEdxpDjcXOs/rIUkpXz+B4dgs1B9fzPq9nFtA8GipduI7m5urgiHafQmOuo0lcvbKuxv1Zi8G/2p9LRNr/nWRLob1QSY9h7ru/2rdxNOY6QyldvbJu6+D2TNzIBEnum2ocVRxZpDQCsbfqGVmMz+ZUetxVs/qIlIWrtbwjMr17TctBb3kEj0cAWWfe1ipotGTWONLp9a2yKBLXGXujXom1J7U3yKQB1CLxrK9Dth6u6fksoxJ7Vh9RJK7eWVdjgD2PRmq915nEnvKOBPPonEorLO/qoyz4DavHtm1qL269P/TuRs4q3ayDzfsM+dXi4LmArZB1e669WjaqLD64ZUacmQE9M4X3MUzvLUvhLLTu7aHC0zxEXdwI1y/tiRSe1NJfQs8S13Pva3FYoOe9nyXkjMCade3evY2zsQ8t8F26o9YCz5ToLo0T72ufuXCmycD7gZ4xydnlYuEAcReagQZYWGAAKDxSBwDKPf87Ic/oBSjunXUyMAB7YABgDwwACAyAwACAwACAwACAwAAIDAAIDABS/gGApcuvEbRK5AAAAABJRU5ErkJggg==";

type JsonSchema = Record<string, unknown>;

export type AllFieldsFixture<Data> = {
  data: Data;
  markers: Array<{ marker: string; path: string }>;
};

function record(value: unknown): JsonSchema {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonSchema) : {};
}

function fixtureFromSchema<Data>(schema: z.ZodType<Data>): AllFieldsFixture<Data> {
  const markers: Array<{ marker: string; path: string }> = [];
  let markerIndex = 0;

  function nextMarker(path: string, value?: (index: number) => string) {
    markerIndex += 1;
    const marker = value?.(markerIndex) ?? `F${String(markerIndex).padStart(3, "0")}`;
    markers.push({ marker, path });
    return marker;
  }

  function valueFor(jsonSchema: JsonSchema, path: string): unknown {
    const enumValues = jsonSchema.enum;
    if (Array.isArray(enumValues) && enumValues.length > 0) return enumValues[0];
    if ("const" in jsonSchema) return jsonSchema.const;

    switch (jsonSchema.type) {
      case "object": {
        const properties = record(jsonSchema.properties);
        return Object.fromEntries(
          Object.entries(properties).map(([key, property]) => [
            key,
            valueFor(record(property), path ? `${path}.${key}` : key),
          ]),
        );
      }
      case "array":
        return [valueFor(record(jsonSchema.items), `${path}[0]`)];
      case "boolean":
        return true;
      case "number":
      case "integer": {
        const marker = nextMarker(path, (index) => String(800_000 + index));
        return Number.parseInt(marker, 10);
      }
      case "string":
        if (path.endsWith("signatureSource")) return TEST_SIGNATURE;
        if (/(?:^|\.)(?:tin|employerTin|printerTin|taxpayerTin)$/.test(path)) {
          return nextMarker(path, (index) => String(900_000_000 + index));
        }
        if (path.endsWith("facilityCode")) {
          return nextMarker(path, (index) => `C${String(index).padStart(3, "0")}`);
        }
        return nextMarker(path);
      default:
        throw new Error(`Unsupported JSON Schema node at ${path || "root"}`);
    }
  }

  const raw = valueFor(record(z.toJSONSchema(schema)), "");
  return { data: schema.parse(raw), markers };
}

export function completeBir1901Fixture(): AllFieldsFixture<Bir1901Data> {
  return fixtureFromSchema(bir1901DataSchema);
}

export function completeBir1905Fixture(): AllFieldsFixture<Bir1905Data> {
  return fixtureFromSchema(bir1905DataSchema);
}
