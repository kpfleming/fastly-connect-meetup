/// <reference types="@fastly/js-compute" />

import MarkdownIt from "markdown-it";
import { KVStore } from "fastly:kv-store";
import { SimpleCache } from "fastly:cache";
import { env } from "fastly:env";

addEventListener("fetch", (event) => event.respondWith(handleRequest(event)));

async function handleRequest(event) {
	let HOST = env("FASTLY_HOSTNAME");
	let req = event.request;
	let url = new URL(req.url);
	if (req.method == "POST" && url.pathname == "/markdown-to-html") {
		var md = new MarkdownIt();
		return new Response(md.render(await req.text()), {
			status: 200,
			headers: new Headers({ "Content-Type": "text/html; charset=utf-8" }),
		});
	} else if (req.method == "POST" && url.pathname == "/add-item") {
		const store = new KVStore("demo_kv_store");
		const receivedText = await req.text();
		await store.put("items", receivedText);
		if (HOST !== "localhost") {
			SimpleCache.purge("items", { scope: "pop" });
			await SimpleCache.getOrSet("items", () => {
				return {
					value: receivedText,
					ttl: 3600 // Store the entry in the cache for 1 hour
				}
			});
		}
		return new Response(true, { status: 200 });
	} else if (req.method == "GET" && url.pathname == "/saved-items") {
		let result = "";
		let cache = null;
		if (HOST !== "localhost") {
			cache = SimpleCache.get("items");
		}
		if (cache) {
			await cache.text().then((value) => result = value);
		} else {
			const store = new KVStore("demo_kv_store");
			const entry = await store.get("items");
			result = await entry.text();
		}
		return new Response(result);
	} else {
		return await fetch(req, {
			backend: "demo_backend"
		});
	}
}

