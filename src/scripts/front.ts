import { Application } from "jsr:@oak/oak";

const app = new Application();
const ROOT = `${Deno.cwd()}/public`;

app.use(async (ctx) => {
    try {
        await ctx.send({
            root: ROOT,
            index: "index.html",
        });
    } catch {
        ctx.response.status = 404;
        ctx.response.body = "404 File not found";
    }
});

console.log("Front server listening on port 8080");
await app.listen({ port: 8080 });