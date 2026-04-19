import router from '@adonisjs/core/services/router'

const DemoController = () => import('#controllers/demo_controller')

router.get('/', [DemoController, 'root'])
router.get('/demo', [DemoController, 'picker'])
router.post('/demo/login/:id', [DemoController, 'login'])
router.get('/demo/agent/:id', [DemoController, 'agentPage'])
