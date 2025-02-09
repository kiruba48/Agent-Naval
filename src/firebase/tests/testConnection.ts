import { firebaseService } from '../service';
import { auth } from '../config';
import { onAuthStateChanged } from 'firebase/auth';

async function testFirebaseConnection() {
    console.log('Starting Firebase connection test...');

    try {
        // Test 1: Create a test user
        console.log('\nTest 1: Creating test user...');
        const testEmail = 'test@example.com';
        const testPassword = 'testPassword123!';
        const testName = 'Test User';

        try {
            const userProfile = await firebaseService.createUser(
                testEmail,
                testPassword,
                testName
            );
            console.log('✅ User created successfully:', userProfile.uid);
        } catch (error: any) {
            if (error.code === 'auth/email-already-in-use') {
                console.log('⚠️ Test user already exists, proceeding with sign in test');
            } else {
                throw error;
            }
        }

        // Test 2: Sign in
        console.log('\nTest 2: Testing sign in...');
        const signedInUser = await firebaseService.signIn(testEmail, testPassword);
        console.log('✅ Sign in successful:', signedInUser.uid);

        // Test 3: Get user profile
        console.log('\nTest 3: Getting user profile...');
        const userProfile = await firebaseService.getUserProfile(signedInUser.uid);
        console.log('✅ User profile retrieved:', userProfile);

        // Test 4: Update user preferences
        console.log('\nTest 4: Updating user preferences...');
        await firebaseService.updateUserPreferences(signedInUser.uid, {
            'mindfulness_practice': { strength: 4 },
            'productivity_tips': { strength: 5 }
        });
        console.log('✅ User preferences updated');

        // Test 5: Get updated profile
        console.log('\nTest 5: Getting updated profile...');
        const updatedProfile = await firebaseService.getUserProfile(signedInUser.uid);
        console.log('✅ Updated profile retrieved:', updatedProfile);

        // Test 6: Sign out
        console.log('\nTest 6: Testing sign out...');
        await firebaseService.signOut();
        console.log('✅ Sign out successful');

        console.log('\n✅ All tests completed successfully!');

    } catch (error) {
        console.error('\n❌ Test failed:', error);
    }

    // Clean up auth state listener
    const unsubscribe = onAuthStateChanged(auth, (user) => {
        console.log('Auth state changed:', user ? 'User is signed in' : 'User is signed out');
    });
    unsubscribe();
}

// Run the tests
testFirebaseConnection().then(() => {
    console.log('\nTest script completed.');
    process.exit(0);
}).catch((error) => {
    console.error('\nTest script failed:', error);
    process.exit(1);
});
