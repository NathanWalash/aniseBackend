import { Router } from 'express';
import { 
  listTasks, 
  getTask, 
  createTask, 
  updateTaskStatus, 
  updateTask, 
  deleteTask 
} from '../controllers/taskController';
import { verifyFirebaseToken } from '../middlewares/verifyFirebaseToken';

const router = Router();

// Protected routes - require authentication
router.use(verifyFirebaseToken);

// GET /api/daos/:daoAddress/tasks - List all tasks (PAGINATED)
router.get('/:daoAddress/tasks', listTasks);

// GET /api/daos/:daoAddress/tasks/:taskId - Get specific task
router.get('/:daoAddress/tasks/:taskId', getTask);

// POST /api/daos/:daoAddress/tasks - Create new task
router.post('/:daoAddress/tasks', createTask);

// PUT /api/daos/:daoAddress/tasks/:taskId/status - Update task status
router.put('/:daoAddress/tasks/:taskId/status', updateTaskStatus);

// PUT /api/daos/:daoAddress/tasks/:taskId - Update task details
router.put('/:daoAddress/tasks/:taskId', updateTask);

// DELETE /api/daos/:daoAddress/tasks/:taskId - Delete task
router.delete('/:daoAddress/tasks/:taskId', deleteTask);

export default router; 