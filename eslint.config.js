import { configPkg } from '@adonisjs/eslint-config'

export default configPkg({
  // Vendored build output of @escalated-dev/escalated.
  ignores: ['resources/widget/**'],
})
