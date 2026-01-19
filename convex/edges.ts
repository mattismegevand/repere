import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

export const upsert = mutation({
	args: {
		sessionId: v.id("sessions"),
		edgeId: v.string(),
		sourceId: v.string(),
		targetId: v.string(),
	},
	handler: async (ctx, args) => {
		// Check if edge already exists
		const edges = await ctx.db
			.query("edges")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.collect()

		const existing = edges.find((e) => e.edgeId === args.edgeId)

		if (existing) {
			await ctx.db.patch(existing._id, {
				sourceId: args.sourceId,
				targetId: args.targetId,
			})
			return existing._id
		}

		return await ctx.db.insert("edges", {
			sessionId: args.sessionId,
			edgeId: args.edgeId,
			sourceId: args.sourceId,
			targetId: args.targetId,
		})
	},
})

export const remove = mutation({
	args: {
		sessionId: v.id("sessions"),
		edgeId: v.string(),
	},
	handler: async (ctx, args) => {
		const edges = await ctx.db
			.query("edges")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.collect()

		const existing = edges.find((e) => e.edgeId === args.edgeId)

		if (existing) {
			await ctx.db.delete(existing._id)
		}
	},
})

export const removeByNodeId = mutation({
	args: {
		sessionId: v.id("sessions"),
		nodeId: v.string(),
	},
	handler: async (ctx, args) => {
		const edges = await ctx.db
			.query("edges")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.collect()

		// Remove edges where nodeId is source or target
		for (const edge of edges) {
			if (edge.sourceId === args.nodeId || edge.targetId === args.nodeId) {
				await ctx.db.delete(edge._id)
			}
		}
	},
})

export const list = query({
	args: { sessionId: v.id("sessions") },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("edges")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.collect()
	},
})

export const bulkUpsert = mutation({
	args: {
		sessionId: v.id("sessions"),
		edges: v.array(
			v.object({
				edgeId: v.string(),
				sourceId: v.string(),
				targetId: v.string(),
			}),
		),
	},
	handler: async (ctx, args) => {
		const existingEdges = await ctx.db
			.query("edges")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.collect()

		const existingMap = new Map(existingEdges.map((e) => [e.edgeId, e]))

		for (const edge of args.edges) {
			const existing = existingMap.get(edge.edgeId)

			if (existing) {
				await ctx.db.patch(existing._id, {
					sourceId: edge.sourceId,
					targetId: edge.targetId,
				})
			} else {
				await ctx.db.insert("edges", {
					sessionId: args.sessionId,
					edgeId: edge.edgeId,
					sourceId: edge.sourceId,
					targetId: edge.targetId,
				})
			}
		}
	},
})
