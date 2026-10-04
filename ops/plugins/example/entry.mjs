export default {
  async activate(context) {
    context.registerHealthCheck(async () => undefined)
  },
  async handle() {
    return { status: 200, headers: { 'content-type': 'application/json' }, body: { ok: true, value: 42 } }
  },
  async deactivate() {},
}
