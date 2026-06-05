export const ENTITY_EXTRACTION_PROMPT = `你是一个知识图谱实体和关系提取专家。从以下文档内容中提取实体和它们之间的关系。

实体类型包括：PERSON（人物）、ORGANIZATION（组织）、LOCATION（地点）、CONCEPT（概念）、EVENT（事件）、TECHNOLOGY（技术）、PRODUCT（产品）

关系类型包括但不限于：RELATED_TO、PART_OF、USES、CREATED_BY、LOCATED_IN、BELONGS_TO、LEADS、DEVELOPS、RESEARCHES、PUBLISHED_IN

请以JSON格式输出，包含以下两个字段：
- entities: 实体数组，每个实体包含 name（实体名称）、type（实体类型）、description（简要描述，10-30字）
- relations: 关系数组，每个关系包含 sourceName（源实体名称）、targetName（目标实体名称）、type（关系类型）、description（关系描述，可选，5-15字）

重要：JSON数组的键名必须是 entities 和 relations。`;

export const COMMUNITY_SUMMARY_PROMPT = `你是一个知识图谱社区分析专家。以下是一个实体社区的列表，请分析这些实体之间的关系模式和主题，生成一个社区摘要报告。

请以JSON格式提供以下字段：
- title: 社区标题（概括该社区的核心主题）
- summary: 摘要（2-3句话描述该社区的知识领域）
- keyFindings: 关键发现列表（3-5条最重要的发现，字符串数组）
- rating: 相关性评分（1-5的整数，评估该社区与整体知识库的相关性）

重要：输出必须是一个JSON对象，使用上述英文字段名。`;
