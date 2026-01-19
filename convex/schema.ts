import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
	sessions: defineTable({
		name: v.string(),
		ownerId: v.string(),
		createdAt: v.number(),
		updatedAt: v.number(),
	}).index("by_owner", ["ownerId"]),

	nodes: defineTable({
		sessionId: v.id("sessions"),
		nodeId: v.string(), // Local UUID from client
		type: v.union(
			v.literal("dataset"),
			v.literal("view"),
			v.literal("chart"),
			v.literal("export"),
		),
		data: v.any(), // Full node data (PipelineNode)
		position: v.object({ x: v.number(), y: v.number() }),
		updatedAt: v.number(),
	})
		.index("by_session", ["sessionId"])
		.index("by_node", ["sessionId", "nodeId"]),

	edges: defineTable({
		sessionId: v.id("sessions"),
		edgeId: v.string(), // Local edge ID from client
		sourceId: v.string(),
		targetId: v.string(),
	}).index("by_session", ["sessionId"]),

	fileRefs: defineTable({
		sessionId: v.id("sessions"),
		nodeId: v.string(),
		r2Key: v.string(), // e.g., "data/{hash}.parquet"
		fileName: v.string(),
		fileSize: v.number(),
		fileHash: v.string(),
	}).index("by_session_node", ["sessionId", "nodeId"]),
})
