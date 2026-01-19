import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

export const upsert = mutation({
	args: {
		sessionId: v.id("sessions"),
		nodeId: v.string(),
		type: v.union(
			v.literal("dataset"),
			v.literal("view"),
			v.literal("chart"),
			v.literal("export"),
		),
		data: v.any(),
		position: v.object({ x: v.number(), y: v.number() }),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("nodes")
			.withIndex("by_node", (q) =>
				q.eq("sessionId", args.sessionId).eq("nodeId", args.nodeId),
			)
			.first()

		const now = Date.now()

		if (existing) {
			await ctx.db.patch(existing._id, {
				type: args.type,
				data: args.data,
				position: args.position,
				updatedAt: now,
			})
			return existing._id
		}

		return await ctx.db.insert("nodes", {
			sessionId: args.sessionId,
			nodeId: args.nodeId,
			type: args.type,
			data: args.data,
			position: args.position,
			updatedAt: now,
		})
	},
})

export const updatePosition = mutation({
	args: {
		sessionId: v.id("sessions"),
		nodeId: v.string(),
		position: v.object({ x: v.number(), y: v.number() }),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("nodes")
			.withIndex("by_node", (q) =>
				q.eq("sessionId", args.sessionId).eq("nodeId", args.nodeId),
			)
			.first()

		if (existing) {
			await ctx.db.patch(existing._id, {
				position: args.position,
				updatedAt: Date.now(),
			})
		}
	},
})

export const remove = mutation({
	args: {
		sessionId: v.id("sessions"),
		nodeId: v.string(),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("nodes")
			.withIndex("by_node", (q) =>
				q.eq("sessionId", args.sessionId).eq("nodeId", args.nodeId),
			)
			.first()

		if (existing) {
			await ctx.db.delete(existing._id)
		}
	},
})

export const list = query({
	args: { sessionId: v.id("sessions") },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("nodes")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.collect()
	},
})

export const get = query({
	args: {
		sessionId: v.id("sessions"),
		nodeId: v.string(),
	},
	handler: async (ctx, args) => {
		return await ctx.db
			.query("nodes")
			.withIndex("by_node", (q) =>
				q.eq("sessionId", args.sessionId).eq("nodeId", args.nodeId),
			)
			.first()
	},
})
