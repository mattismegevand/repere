import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { action, mutation, query } from "./_generated/server"
import { v } from "convex/values"

// R2 client singleton (lazily initialized)
let r2Client: S3Client | null = null

function getR2Client(): S3Client | null {
	if (r2Client) return r2Client

	const endpoint = process.env.R2_ENDPOINT
	const accessKeyId = process.env.R2_ACCESS_KEY_ID
	const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY

	if (!endpoint || !accessKeyId || !secretAccessKey) {
		return null
	}

	r2Client = new S3Client({
		region: "auto",
		endpoint,
		credentials: { accessKeyId, secretAccessKey },
	})

	return r2Client
}

// Store file reference after upload to R2
export const saveRef = mutation({
	args: {
		sessionId: v.id("sessions"),
		nodeId: v.string(),
		r2Key: v.string(),
		fileName: v.string(),
		fileSize: v.number(),
		fileHash: v.string(),
	},
	handler: async (ctx, args) => {
		// Check if reference already exists
		const existing = await ctx.db
			.query("fileRefs")
			.withIndex("by_session_node", (q) =>
				q.eq("sessionId", args.sessionId).eq("nodeId", args.nodeId),
			)
			.first()

		if (existing) {
			await ctx.db.patch(existing._id, {
				r2Key: args.r2Key,
				fileName: args.fileName,
				fileSize: args.fileSize,
				fileHash: args.fileHash,
			})
			return existing._id
		}

		return await ctx.db.insert("fileRefs", {
			sessionId: args.sessionId,
			nodeId: args.nodeId,
			r2Key: args.r2Key,
			fileName: args.fileName,
			fileSize: args.fileSize,
			fileHash: args.fileHash,
		})
	},
})

export const getRef = query({
	args: {
		sessionId: v.id("sessions"),
		nodeId: v.string(),
	},
	handler: async (ctx, args) => {
		return await ctx.db
			.query("fileRefs")
			.withIndex("by_session_node", (q) =>
				q.eq("sessionId", args.sessionId).eq("nodeId", args.nodeId),
			)
			.first()
	},
})

export const listRefs = query({
	args: { sessionId: v.id("sessions") },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("fileRefs")
			.withIndex("by_session_node", (q) => q.eq("sessionId", args.sessionId))
			.collect()
	},
})

export const removeRef = mutation({
	args: {
		sessionId: v.id("sessions"),
		nodeId: v.string(),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("fileRefs")
			.withIndex("by_session_node", (q) =>
				q.eq("sessionId", args.sessionId).eq("nodeId", args.nodeId),
			)
			.first()

		if (existing) {
			await ctx.db.delete(existing._id)
		}
	},
})

// Action to generate presigned URLs for R2 uploads
export const getUploadUrl = action({
	args: {
		fileHash: v.string(),
		contentType: v.string(),
	},
	handler: async (_ctx, args) => {
		const r2 = getR2Client()
		const bucket = process.env.R2_BUCKET

		if (!r2 || !bucket) {
			return {
				uploadUrl: null as string | null,
				key: `data/${args.fileHash}.parquet`,
				configured: false,
			}
		}

		const key = `data/${args.fileHash}.parquet`
		const command = new PutObjectCommand({
			Bucket: bucket,
			Key: key,
			ContentType: args.contentType,
		})

		const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 3600 })

		return { uploadUrl, key, configured: true }
	},
})

// Action to generate presigned URLs for R2 downloads
export const getDownloadUrl = action({
	args: {
		r2Key: v.string(),
	},
	handler: async (_ctx, args) => {
		const r2 = getR2Client()
		const bucket = process.env.R2_BUCKET

		if (!r2 || !bucket) {
			return {
				downloadUrl: null as string | null,
				key: args.r2Key,
				configured: false,
			}
		}

		const command = new GetObjectCommand({
			Bucket: bucket,
			Key: args.r2Key,
		})

		const downloadUrl = await getSignedUrl(r2, command, { expiresIn: 3600 })

		return { downloadUrl, key: args.r2Key, configured: true }
	},
})
