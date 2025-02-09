import * as readlineSync from 'readline-sync';
import { firebaseService } from '../firebase/service';
import { User } from 'firebase/auth';

export async function handleAuthFlow(): Promise<User> {
    console.log('\n🔐 Authentication Required');
    
    while (true) {
        const action = readlineSync.question(
            '\nChoose an action:\n1. Sign In\n2. Create Account\n> '
        );

        try {
            if (action === '1') {
                // Sign In
                const email = readlineSync.question('Email: ');
                const password = readlineSync.question('Password: ', { hideEchoBack: true });
                
                const user = await firebaseService.signIn(email, password);
                console.log('\n✅ Successfully signed in!');
                return user;

            } else if (action === '2') {
                // Create Account
                const name = readlineSync.question('Name: ');
                const email = readlineSync.question('Email: ');
                const password = readlineSync.question('Password: ', { hideEchoBack: true });
                
                const userProfile = await firebaseService.createUser(email, password, name);
                console.log('\n✅ Account created successfully!');
                return await firebaseService.signIn(email, password);

            } else {
                console.log('\n❌ Invalid option. Please choose 1 or 2.');
            }
        } catch (error: any) {
            console.error('\n❌ Authentication error:', error.message);
            if (error.code === 'auth/email-already-in-use') {
                console.log('This email is already registered. Please sign in.');
            } else if (error.code === 'auth/invalid-email') {
                console.log('Invalid email format.');
            } else if (error.code === 'auth/weak-password') {
                console.log('Password should be at least 6 characters.');
            }
        }
    }
}
