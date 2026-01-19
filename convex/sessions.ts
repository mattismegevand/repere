import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

export const create = mutation({
	args: {
		name: v.string(),
		ownerId: v.string(),
	},
	handler: async (ctx, args) => {
		const now = Date.now()
		return await ctx.db.insert("sessions", {
			name: args.name,
			ownerId: args.ownerId,
			createdAt: now,
			updatedAt: now,
		})
	},
})

export const get = query({
	args: { sessionId: v.id("sessions") },
	handler: async (ctx, args) => {
		return await ctx.db.get(args.sessionId)
	},
})

export const list = query({
	args: { ownerId: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("sessions")
			.withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId))
			.order("desc")
			.collect()
	},
})

export const rename = mutation({
	args: {
		sessionId: v.id("sessions"),
		name: v.string(),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.sessionId, {
			name: args.name,
			updatedAt: Date.now(),
		})
	},
})

export const remove = mutation({
	args: { sessionId: v.id("sessions") },
	handler: async (ctx, args) => {
		// Delete all nodes
		const nodes = await ctx.db
			.query("nodes")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.collect()
		for (const node of nodes) {
			await ctx.db.delete(node._id)
		}

		// Delete all edges
		const edges = await ctx.db
			.query("edges")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.collect()
		for (const edge of edges) {
			await ctx.db.delete(edge._id)
		}

		// Delete all file refs
		const fileRefs = await ctx.db
			.query("fileRefs")
			.withIndex("by_session_node", (q) => q.eq("sessionId", args.sessionId))
			.collect()
		for (const fileRef of fileRefs) {
			await ctx.db.delete(fileRef._id)
		}

		// Delete session
		await ctx.db.delete(args.sessionId)
	},
})

export const touch = mutation({
	args: { sessionId: v.id("sessions") },
	handler: async (ctx, args) => {
		await ctx.db.patch(args.sessionId, {
			updatedAt: Date.now(),
		})
	},
})
