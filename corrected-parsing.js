// CORRECTED Manual community parser - uses the actual Rust struct field order
const manualParseCommunityCorrect = (data) => {
  try {
    // Basic validation - communities should have a minimum size
    if (data.length < 100) return null // Communities need at least 100 bytes for basic structure
    
    let offset = 0
    
    // Parse each field manually based on ACTUAL Rust Community structure:
    // is_initialized: bool, id: u64, name: String, description: String, 
    // avatar: String, owner: Pubkey, member_count: u64, rules: Vec<String>, is_sb_community: bool
    
    const is_initialized = data[offset]
    if (is_initialized !== 1) return null // Must be initialized
    offset += 1
    
    // Parse id (u64)
    if (offset + 8 > data.length) return null
    const id = data.readBigUInt64LE(offset)
    offset += 8
    
    // Parse name (string) - comes BEFORE creator in Rust struct
    if (offset + 4 > data.length) return null
    const nameLength = data.readUInt32LE(offset)
    offset += 4
    
    if (nameLength > 100 || nameLength === 0) return null // Validate name length
    if (offset + nameLength > data.length) return null
    
    const name = data.slice(offset, offset + nameLength).toString('utf8')
    offset += nameLength
    
    // Parse description (string)
    if (offset + 4 > data.length) return null
    const descriptionLength = data.readUInt32LE(offset)
    offset += 4
    
    if (descriptionLength > 1000) return null // Validate description length
    if (offset + descriptionLength > data.length) return null
    
    const description = data.slice(offset, offset + descriptionLength).toString('utf8')
    offset += descriptionLength
    
    // Parse avatar (string)
    if (offset + 4 > data.length) return null
    const avatarLength = data.readUInt32LE(offset)
    offset += 4
    
    if (avatarLength > 500) return null // Validate avatar length
    if (offset + avatarLength > data.length) return null
    
    const avatar = data.slice(offset, offset + avatarLength).toString('utf8')
    offset += avatarLength
    
    // Parse owner/creator (32 bytes) - comes AFTER strings in Rust struct
    if (offset + 32 > data.length) return null
    const creator = data.slice(offset, offset + 32)
    offset += 32
    
    // Parse member_count (u64)
    if (offset + 8 > data.length) return null
    const member_count = data.readBigUInt64LE(offset)
    offset += 8
    
    // Parse rules (Vec<String>)
    if (offset + 4 > data.length) return null
    const rulesCount = data.readUInt32LE(offset)
    offset += 4
    
    const rules = []
    for (let i = 0; i < rulesCount && i < 10; i++) { // Limit to 10 rules max
      if (offset + 4 > data.length) return null
      const ruleLength = data.readUInt32LE(offset)
      offset += 4
      
      if (ruleLength > 200) return null // Validate rule length
      if (offset + ruleLength > data.length) return null
      
      const rule = data.slice(offset, offset + ruleLength).toString('utf8')
      rules.push(rule)
      offset += ruleLength
    }
    
    // Parse is_sb_community (bool) - last field
    if (offset + 1 > data.length) return null
    const is_private = data[offset] // Using is_private for compatibility with existing interface
    offset += 1
    
    // Parse created_at - this might not exist in the Rust struct, so we'll use current time
    const created_at = BigInt(Date.now())
    
    return {
      is_initialized,
      id,
      creator,
      name,
      description,
      avatar,
      rules,
      member_count,
      created_at,
      is_private,
    }
  } catch (error) {
    console.log(`❌ Error in manualParseCommunityCorrect:`, error)
    return null
  }
}

// The key difference is the field order:
// OLD (WRONG): is_initialized, id, creator, name, description, avatar, ...
// NEW (CORRECT): is_initialized, id, name, description, avatar, creator, ... 