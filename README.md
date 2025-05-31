# Blocks - Decentralized Social Media Platform

A decentralized social media platform built on Solana blockchain where users truly own their content and earn tokens for engagement.

## 🌟 Features

### Core Social Features
- **User Profiles**: Create and customize your profile with username, bio, and images
- **Posts**: Share text and images with the community
- **Interactions**: Like, comment, share, and bookmark posts
- **Communities**: Create and join SubBlocks (Reddit-like communities)
- **Following System**: Follow other users to see their content

### Blockchain Features
- **Phantom Wallet Integration**: Connect your Solana wallet
- **BLKS Token Rewards**: Earn tokens based on likes and engagement
- **Content Ownership**: Your posts are stored on the blockchain
- **UCR (User Credit Rating)**: Build reputation through quality content
- **IPFS Storage**: Profile and cover images stored on IPFS for decentralized access

### Content Rating System
Posts are automatically rated based on likes:
- **No rating**: 0 likes
- **Bronze**: 5+ likes
- **Silver**: 20+ likes
- **Gold**: 50+ likes
- **Platinum**: 150+ likes
- **Diamond**: 500+ likes
- **Ace**: 1000+ likes
- **Conqueror**: 1,000,000+ likes

### Kill Zone Protection
Posts with net votes below 2 enter the "kill zone" and become less visible to protect content quality.

## 🏗️ Architecture

### Smart Contracts
- **Program ID**: `your_program_id` (Devnet)
- **Network**: Solana Devnet
- **Instructions**: Profile creation, posting, liking, community management

### Frontend Stack
- **Framework**: Next.js 14 with App Router
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Wallet**: Solana Wallet Adapter
- **Storage**: IPFS for decentralized image storage
- **State Management**: React Hooks

### Decentralized Storage
- **IPFS Integration**: Profile and cover images uploaded to IPFS
- **Pinata Support**: Ready for Pinata service integration
- **Fallback**: Mock IPFS hashes for development/demo

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- Phantom Wallet browser extension
- Some SOL in your devnet wallet
- (Optional) Pinata account for production IPFS uploads

### Installation

1. **Clone and setup the project**:
```bash
cd blockchain
npm install
```

2. **Configure environment** (optional for production):
```bash
cp env.example .env.local
# Edit .env.local with your Pinata credentials
```

3. **Start the development server**:
```bash
npm run dev
```

4. **Open your browser**:
Navigate to `http://localhost:3000`

### First Time Setup

1. **Browse Content**:
   - The feed is visible to everyone without wallet connection
   - Explore posts and communities freely

2. **Connect Phantom Wallet**:
   - Click "Connect Wallet" when you want to interact
   - Make sure you're on Solana Devnet
   - Ensure you have some SOL for transaction fees

3. **Create Your Profile**:
   - Upload profile and cover images (stored on IPFS)
   - Fill in your username and bio
   - Submit the blockchain transaction

4. **Start Engaging**:
   - Like posts to support creators
   - Create your own posts with images
   - Join communities and build your UCR

## 📱 Usage Guide

### Image Uploads
- **IPFS Storage**: All profile images stored on IPFS for permanence
- **File Support**: JPEG, PNG, WebP, GIF (max 5MB each)
- **Preview**: Real-time preview during upload
- **Validation**: Automatic file type and size validation

### Creating Content
- **Posts**: Click the + icon to create a new post
- **Communities**: Browse or create SubBlocks for specific topics
- **Engagement**: Like posts to support creators and build your UCR

### Building Reputation
- **Create Quality Content**: Higher engagement improves your UCR
- **Engage Thoughtfully**: Meaningful interactions boost credibility
- **Follow Community Guidelines**: Avoid spam to prevent UCR decline

### Understanding UCR Tiers
- **Top Contributor**: 4.20+ (420+ points)
- **Valuable Contributor**: 0.69+ (69+ points)
- **Average Contributor**: 0.01+ (1+ points)
- **Low Value Contributor**: -0.03+ (-3+ points)
- **Spam User**: Below -0.1 (-10+ points)

## 🛠️ Development

### Project Structure
```
├── app/                    # Next.js app router pages
├── components/            # React components
├── hooks/                 # Custom React hooks
├── utils/                 # Utility functions (IPFS, etc.)
├── contracts/            # Solana smart contracts
│   └── solana/          # Rust program source
└── public/               # Static assets
```

### Key Components
- **WalletContextProvider**: Solana wallet integration
- **Navigation**: Top navigation with wallet connection
- **Feed**: Main content feed with posts
- **CreatePost**: Modal for creating new posts
- **CreateProfileModal**: Profile creation with IPFS uploads
- **UserProfile**: Profile display and management
- **Sidebar**: Navigation and community discovery

### IPFS Integration
- **Development**: Mock IPFS uploads for testing
- **Production**: Pinata service integration
- **Utilities**: File validation, preview generation
- **Storage**: Decentralized image hosting

### Smart Contract Integration
The frontend connects to your deployed Solana program using:
- **Program ID**: Configured in `hooks/useBlocksProgram.ts`
- **Instructions**: Borsh serialization for contract calls
- **PDAs**: Program Derived Addresses for data storage

## 🔧 Configuration

### Environment Variables
Create a `.env.local` file:
```bash
# Required
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_PROGRAM_ID=your_program_id

# Optional (for production IPFS)
NEXT_PUBLIC_PINATA_JWT=your_pinata_jwt_token
NEXT_PUBLIC_PINATA_GATEWAY=your_pinata_gateway_url
```

### Wallet Network
Ensure your Phantom wallet is set to **Devnet** for testing.

### IPFS Setup (Production)
1. Sign up at [Pinata Cloud](https://pinata.cloud)
2. Generate API keys
3. Add keys to your `.env.local`
4. Uncomment production upload function in `utils/ipfs.ts`

## 🚨 Important Notes

- **Devnet Only**: This is configured for Solana devnet testing
- **Mock IPFS**: Development uses simulated IPFS uploads
- **Gas Fees**: Transactions require SOL for gas fees
- **Image Storage**: IPFS ensures permanent, decentralized storage
- **Beta Software**: This is experimental software for testing

## 🔗 IPFS Features

### Current Implementation
- **Mock Uploads**: Simulated IPFS hashes for development
- **File Validation**: Type and size checking
- **Preview System**: Real-time image previews
- **Progress Tracking**: Upload status indicators

### Production Ready
- **Pinata Integration**: Ready for real IPFS uploads
- **Error Handling**: Comprehensive upload error management
- **Retry Logic**: Built-in upload retry mechanisms
- **Gateway Fallbacks**: Multiple IPFS gateway support

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly (including IPFS uploads)
5. Submit a pull request

## 📄 License

This project is open source and available under the MIT License.

## 🆘 Support

If you encounter issues:
1. Check that your wallet is on Solana Devnet
2. Ensure you have SOL for transaction fees
3. Verify the program ID is correct
4. Check browser console for error messages
5. For IPFS issues, verify file size and format
6. Ensure stable internet connection for uploads

---

**Built with ❤️ on Solana & IPFS** | **Decentralized Social Media for Everyone** 