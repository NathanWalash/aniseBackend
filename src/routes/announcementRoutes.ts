import { Router } from 'express';
import { 
  listAnnouncements, 
  getAnnouncement, 
  createAnnouncement, 
  updateAnnouncement, 
  deleteAnnouncement 
} from '../controllers/announcementController';
import { verifyFirebaseToken } from '../middlewares/verifyFirebaseToken';

const router = Router();

// Protected routes - require authentication
router.use(verifyFirebaseToken);

// GET /api/daos/:daoAddress/announcements - List active announcements (PAGINATED)
router.get('/:daoAddress/announcements', listAnnouncements);

// GET /api/daos/:daoAddress/announcements/:announcementId - Get specific announcement
router.get('/:daoAddress/announcements/:announcementId', getAnnouncement);

// POST /api/daos/:daoAddress/announcements - Create new announcement
router.post('/:daoAddress/announcements', createAnnouncement);

// PUT /api/daos/:daoAddress/announcements/:announcementId - Update announcement
router.put('/:daoAddress/announcements/:announcementId', updateAnnouncement);

// DELETE /api/daos/:daoAddress/announcements/:announcementId - Delete announcement
router.delete('/:daoAddress/announcements/:announcementId', deleteAnnouncement);

export default router; 