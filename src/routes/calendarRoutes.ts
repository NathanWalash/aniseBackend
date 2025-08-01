import { Router } from 'express';
import { 
  listEvents, 
  getUpcomingEvents, 
  getEvent, 
  createEvent, 
  updateEvent, 
  deleteEvent 
} from '../controllers/calendarController';
import { verifyFirebaseToken } from '../middlewares/verifyFirebaseToken';

const router = Router();

// Protected routes - require authentication
router.use(verifyFirebaseToken);

// GET /api/daos/:daoAddress/events - List all events (PAGINATED)
router.get('/:daoAddress/events', listEvents);

// GET /api/daos/:daoAddress/events/upcoming - Get upcoming events
router.get('/:daoAddress/events/upcoming', getUpcomingEvents);

// GET /api/daos/:daoAddress/events/:eventId - Get specific event
router.get('/:daoAddress/events/:eventId', getEvent);

// POST /api/daos/:daoAddress/events - Create new event
router.post('/:daoAddress/events', createEvent);

// PUT /api/daos/:daoAddress/events/:eventId - Update event
router.put('/:daoAddress/events/:eventId', updateEvent);

// DELETE /api/daos/:daoAddress/events/:eventId - Delete event
router.delete('/:daoAddress/events/:eventId', deleteEvent);

export default router; 