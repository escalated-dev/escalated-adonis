import router from '@adonisjs/core/services/router'

const DemoController = () => import('#controllers/demo_controller')

router.get('/demo', [DemoController, 'index'])
