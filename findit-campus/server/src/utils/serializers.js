function toPublicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    collegeId: user.collegeId,
    trustScore: user.trustScore,
    isAdmin: user.isAdmin,
  };
}

// Never include `secretAnswer` here — this is the one place that matters.
function toPublicPost(post) {
  return {
    id: post.id,
    type: post.type,
    category: post.category,
    title: post.title,
    description: post.description,
    dateEvent: post.dateEvent,
    locationText: post.locationText,
    status: post.status,
    createdAt: post.createdAt,
    owner: toPublicUser(post.user),
    images: (post.images || []).map((img) => img.url),
    verificationQuestion: post.challenge ? post.challenge.questionText : null,
  };
}

module.exports = { toPublicUser, toPublicPost };
