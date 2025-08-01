import * as admin from 'firebase-admin';
import firebaseAdmin from '../firebaseAdmin';

const db = firebaseAdmin.firestore();

export const updateAllDaoMemberCounts = async () => {
  try {
    console.log('Starting to update member counts for all DAOs...');
    
    const daosSnapshot = await db.collection('daos').get();
    let updatedCount = 0;
    
    for (const daoDoc of daosSnapshot.docs) {
      const daoAddress = daoDoc.id;
      const membersSnapshot = await db.collection('daos').doc(daoAddress).collection('members').get();
      const memberCount = membersSnapshot.size;
      
      await db.collection('daos').doc(daoAddress).update({
        memberCount: memberCount
      });
      
      console.log(`Updated DAO ${daoAddress} with ${memberCount} members`);
      updatedCount++;
    }
    
    console.log(`Successfully updated member counts for ${updatedCount} DAOs`);
  } catch (error) {
    console.error('Error updating member counts:', error);
    throw error;
  }
};

export const updateDaoMemberCount = async (daoAddress: string) => {
  try {
    const membersSnapshot = await db.collection('daos').doc(daoAddress).collection('members').get();
    const memberCount = membersSnapshot.size;
    
    await db.collection('daos').doc(daoAddress).update({
      memberCount: memberCount
    });
    
    console.log(`Updated DAO ${daoAddress} with ${memberCount} members`);
    return memberCount;
  } catch (error) {
    console.error(`Error updating member count for DAO ${daoAddress}:`, error);
    throw error;
  }
};

// Run this if the file is executed directly
if (require.main === module) {
  updateAllDaoMemberCounts()
    .then(() => {
      console.log('Member count update completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Member count update failed:', error);
      process.exit(1);
    });
} 