import { z } from "zod";

export const EntitySchema = z.object({
  name: z.string().describe("实体名称"),
  type: z.enum(["PERSON", "ORGANIZATION", "LOCATION", "CONCEPT", "EVENT", "TECHNOLOGY", "PRODUCT"]).describe("实体类型"),
  description: z.string().describe("简要描述"),
});

export const RelationshipSchema = z.object({
  sourceName: z.string().describe("源实体名称"),
  targetName: z.string().describe("目标实体名称"),
  type: z.string().describe("关系类型"),
  description: z.string().optional().describe("关系描述"),
});

export const ExtractionSchema = z.object({
  entities: z.array(EntitySchema),
  relations: z.array(RelationshipSchema).optional(),
  relationships: z.array(RelationshipSchema).optional(),
}).transform((data) => ({
  entities: data.entities,
  relations: data.relations ?? data.relationships ?? [],
}));

export const FindingSchema = z.object({
  finding: z.string().describe("关键发现"),
});

export const CommunitySummarySchema = z.object({
  title: z.string().describe("社区标题"),
  summary: z.string().describe("社区摘要"),
  keyFindings: z.array(z.string()).describe("关键发现列表"),
  rating: z.number().min(1).max(5).describe("相关性评分"),
});
