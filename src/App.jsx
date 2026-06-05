import React, { useState } from 'react';

// --- MOCK CONSTANTS BASED ON REQUIREMENTS ---
const WORKOUT_TYPE_MAPS = {
  'Push': ['shoulders', 'chest', 'triceps'],
  'Pull': ['lats', 'upper_back', 'rear_delts', 'biceps'], 
  'Legs': ['quads', 'hamstrings', 'calves', 'adductors', 'glutes', 'compound'],
  'Upper': ['chest', 'shoulders', 'triceps', 'lats', 'upper_back', 'biceps', 'rear_delts', 'abs']
};

// Initial state extended to support exercise-level tracking and historical data
const INITIAL_MUSCLE_DATA = {
  upper: [
    { id: 'chest', name: 'Chest', frequency: 0, volume: 0, weeklySets: [], lastSession: [], exercises: [] },
    { id: 'shoulders', name: 'Shoulders', frequency: 0, volume: 0, weeklySets: [], lastSession: [], exercises: [] },
    { id: 'triceps', name: 'Triceps', frequency: 0, volume: 0, weeklySets: [], lastSession: [], exercises: [] },
    { id: 'lats', name: 'Lats', frequency: 0, volume: 0, weeklySets: [], lastSession: [], exercises: [] },
    { id: 'upper_back', name: 'Upper Back', frequency: 0, volume: 0, weeklySets: [], lastSession: [], exercises: [] },
    { id: 'biceps', name: 'Biceps', frequency: 0, volume: 0, weeklySets: [], lastSession: [], exercises: [] },
    { id: 'rear_delts', name: 'Rear Delts', frequency: 0, volume: 0, weeklySets: [], lastSession: [], exercises: [] },
    { id: 'abs', name: 'Abs', frequency: 0, volume: 0, weeklySets: [], lastSession: [], exercises: [] },
  ],
  lower: [
    { id: 'quads', name: 'Quads', frequency: 0, volume: 0, weeklySets: [], lastSession: [], exercises: [] },
    { id: 'hamstrings', name: 'Hamstrings', frequency: 0, volume: 0, weeklySets: [], lastSession: [], exercises: [] },
    { id: 'calves', name: 'Calves', frequency: 0, volume: 0, weeklySets: [], lastSession: [], exercises: [] },
    { id: 'adductors', name: 'Adductors', frequency: 0, volume: 0, weeklySets: [], lastSession: [], exercises: [] },
    { id: 'glutes', name: 'Glutes', frequency: 0, volume: 0, weeklySets: [], lastSession: [], exercises: [] },
    { id: 'compound', name: 'Compound', frequency: 0, volume: 0, weeklySets: [], lastSession: [], exercises: [] },
  ]
};

// --- DECOUPLED DUAL PR PARSING UTILITY LOGIC ---
const calculatePRString = (currentHistoryPrStr, incomingSetsArray, fullHistoryArray = []) => {
  let allSetTokens = [];

  // 1. Gather historical PR tokens
  if (currentHistoryPrStr && currentHistoryPrStr !== 'None') {
    allSetTokens.push(...currentHistoryPrStr.split(',').map(s => s.trim().toLowerCase()));
  }

  // 2. Gather active input workspace values
  if (incomingSetsArray && incomingSetsArray.length > 0) {
    allSetTokens.push(...incomingSetsArray.map(s => s.trim().toLowerCase()));
  }

 // 3. Scan historical multi-session object arrays
if (Array.isArray(fullHistoryArray)) {
  fullHistoryArray.forEach(sessionObj => {
    if (sessionObj && Array.isArray(sessionObj.sets)) {
      allSetTokens.push(...sessionObj.sets.map(s => s.trim().toLowerCase()));
    } else if (typeof sessionObj === 'string') {
      allSetTokens.push(...sessionObj.split(',').map(s => s.trim().toLowerCase()));
    }
  });
}

  let maxOneRepWeight = -1;
  let maxVolWeight = -1;
  let maxVolReps = -1;

  allSetTokens.forEach(token => {
    if (token.includes('x')) {
      const parts = token.split('x');
      const weight = parseFloat(parts[0]);
      const reps = parseInt(parts[1], 10);

      if (!isNaN(weight) && !isNaN(reps)) {
        // Track standalone 1-rep absolute max metrics independently
        if (reps === 1) {
          if (weight > maxOneRepWeight) {
            maxOneRepWeight = weight;
          }
        } else if (reps > 1) {
          // Track highest weight for structural reps (>1 rep targets)
          // 70x5 beats 65x5 AND 70x5 beats 70x4
          if (weight > maxVolWeight) {
            maxVolWeight = weight;
            maxVolReps = reps;
          } else if (weight === maxVolWeight && reps > maxVolReps) {
            maxVolReps = reps;
          }
        }
      }
    }
  });

  // Fallback check: if there are no sets with reps > 1, but we have a 1-rep set, treat it as the absolute maximum.
  if (maxVolWeight === -1 && maxOneRepWeight !== -1) {
    return `${maxOneRepWeight}x1`;
  }
  if (maxVolWeight === -1 && maxOneRepWeight === -1) {
    return 'None';
  }

  const bestVolSet = `${maxVolWeight}x${maxVolReps}`;

  // Return BOTH side-by-side if a true single-rep maximum exists
  if (maxOneRepWeight !== -1) {
    return `${maxOneRepWeight}x1, ${bestVolSet}`;
  }

  return bestVolSet;
};

export default function App() {
  // --- NAVIGATION STATE ---
  const [currentScreen, setCurrentScreen] = useState('DASHBOARD');
  const [selectedStatsExercise, setSelectedStatsExercise] = useState(null);
  const [timeframe, setTimeframe] = useState('ALL');
  const [statsTab, setStatsTab] = useState('Workout'); // 'Workout', 'General'
  
  // --- CORE SYSTEM STATE ---
  const [muscleData, setMuscleData] = useState(INITIAL_MUSCLE_DATA);
  const [expandedMuscleId, setExpandedMuscleId] = useState(null);

  // --- FORM SELECTION STATES ---
  const [logForm, setLogForm] = useState({
    date: 'Today',
    customDate: '',
    location: 'Planet Fitness',
    customLocation: '',
    type: 'Push',
    customType: ''
  });

  // --- ACTIVE TRACKING SESSION STATES ---
  const [currentActiveMuscleGroups, setCurrentActiveMuscleGroups] = useState([]);
  const [completedExerciseIds, setCompletedExerciseIds] = useState([]);
  const [sessionTodaySummary, setSessionTodaySummary] = useState([]);

  // --- LOG EXERCISE INDIVIDUAL WORKSPACE ---
  const [activeExerciseWorkspace, setActiveExerciseWorkspace] = useState(null);
  const [workspaceSets, setWorkspaceSets] = useState(['']);
  // --- ADD CUSTOM EXERCISE STATE ---
  const [customExerciseForm, setCustomExerciseForm] = useState({
    name: '',
    targetMuscleId: 'chest'
  });

  // --- STRICT COLOR-CODING LOGIC ---
  const getFrequencyColor = (freq) => {
    if (freq === 0) return '#ffccd5'; 
    if (freq === 1) return '#fef08a'; 
    return '#bbf7d0';                 
  };

  const getVolumeColor = (vol) => {
    if (vol <= 1) return '#ffccd5';             
    if (vol >= 2 && vol <= 6) return '#fef08a'; 
    if (vol > 6 && vol <= 8) return '#bbf7d0';  
    return '#fee2e2'; 
  };

  // --- SUNDAY RESET EVENT ---
  const handleSundayReset = () => {
    const resetData = {
      upper: muscleData.upper.map(m => ({ ...m, frequency: 0, volume: 0, weeklySets: [] })),
      lower: muscleData.lower.map(m => ({ ...m, frequency: 0, volume: 0, weeklySets: [] }))
    };
    setMuscleData(resetData);
    setExpandedMuscleId(null);
    setCompletedExerciseIds([]);
    setSessionTodaySummary([]);
  };

  // --- ROW EXPANSION CLICK HANDLE ---
  const handleMuscleClick = (id) => {
    if (expandedMuscleId === id) {
      setExpandedMuscleId(null);
    } else {
      setExpandedMuscleId(id);
    }
  };

  // --- NAVIGATION: STEPPING INTO ACTIVE SESSION ---
  const handleLogWorkoutNext = () => {
    const selectedWorkoutType = logForm.type === 'Other' ? logForm.customType : logForm.type;
    const targetMuscleKeys = WORKOUT_TYPE_MAPS[selectedWorkoutType] || [];
    
    const combinedDashboardData = [...muscleData.upper, ...muscleData.lower];
    const filteredGroups = combinedDashboardData.filter(g => targetMuscleKeys.includes(g.id));
    
    setCurrentActiveMuscleGroups(filteredGroups);
    setCurrentScreen('ACTIVE_SESSION');
  };

  // --- NAVIGATION: STEPPING INTO LOG EXERCISE FORM ---
  const handleInitLogExercise = (muscleGroup, exercise) => {
    setActiveExerciseWorkspace({ muscleGroup, exercise });
    setWorkspaceSets(['']);
    setCurrentScreen('LOG_EXERCISE');
  };

  // --- ACTION: SAVE DATA PARSED FROM LOG EXERCISE ---
  const handleSaveExerciseLogs = () => {
    const validEnteredSets = workspaceSets.filter(s => s.trim() !== '');
    const newlyAddedSetsCount = validEnteredSets.length;
    const targetGroupId = activeExerciseWorkspace.muscleGroup.id;
    const exerciseName = activeExerciseWorkspace.exercise.name;

    // Calculate the most recent Sunday reset timestamp at midnight local time
    const todayObj = new Date();
    const currentDayOfWeek = todayObj.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const lastSundayObj = new Date(todayObj);
    lastSundayObj.setDate(todayObj.getDate() - currentDayOfWeek);
    lastSundayObj.setHours(0, 0, 0, 0);

    // Parse the incoming resolved date string
    const resolvedDate = logForm.date === 'Today' 
      ? new Date().toISOString().split('T')[0] // localDateString variable from your previous step
      : logForm.customDate;
      
    const logDateObj = new Date(resolvedDate + 'T00:00:00');

    // Check if the logged workout is before the current week's Sunday reset window
    const isBackdatedToPriorWeek = logDateObj < lastSundayObj;

    if (newlyAddedSetsCount === 0) {
      setCurrentScreen('ACTIVE_SESSION');
      return;
    }

    // Dynamic Volume Matrix Boundary Checks
    const currentGroupVolume = activeExerciseWorkspace.muscleGroup.volume;
    if (currentGroupVolume + newlyAddedSetsCount > 8) {
      alert(`Warning: "This set makes your volume greater than 8"`);
    }

    // Construct Display Log Lines
    // 1. Establish the session execution date string for the dashboard display line
    const logDateString = logForm.date === 'Today' 
    ? new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' }) 
    : logForm.customDate ? logForm.customDate.split('-').slice(1).join('/') : ''; // Formats YYYY-MM-DD to MM/DD

    // 2. Construct Display Log Lines with Date included
    const workoutSummaryLine = `${logDateString ? `[${logDateString}] ` : ''}${exerciseName}: ${validEnteredSets.join(', ')}`;

    // Check if any exercise belonging to this muscle group has already been completed in this session
    const groupAlreadyHitInSession = activeExerciseWorkspace.muscleGroup.exercises.some(ex => 
      completedExerciseIds.includes(ex.id)
    );

    // Only increment frequency if this muscle group hasn't been touched yet during this session
    const frequencyIncrement = groupAlreadyHitInSession ? 0 : 1;

    const formattedSetsString = validEnteredSets.join(', ');

    // Deep copy, increment targeted nodes, and overwrite exercise history
    const mapper = (list) => list.map(m => {
      if (m.id === targetGroupId) {
        return {
          ...m,
          // Only increment active weekly stats if the workout happened during THIS week
          frequency: isBackdatedToPriorWeek ? m.frequency : m.frequency + frequencyIncrement,
          volume: isBackdatedToPriorWeek ? m.volume : m.volume + newlyAddedSetsCount,
          weeklySets: isBackdatedToPriorWeek ? m.weeklySets : [...m.weeklySets, workoutSummaryLine],
          
          // Always update the standalone group history array so it saves to the accordion preview
          lastSession: isBackdatedToPriorWeek ? [workoutSummaryLine] : m.lastSession,
          
          exercises: m.exercises.map(ex => {
            if (ex.id === activeExerciseWorkspace.exercise.id) {
              // Parse existing history into an array or handle initial blank arrays
              // 1. Establish the session execution date string
              // 1. Establish the session execution date string using Local Time instead of UTC
              const localToday = new Date();
              const year = localToday.getFullYear();
              const month = String(localToday.getMonth() + 1).padStart(2, '0');
              const day = String(localToday.getDate()).padStart(2, '0');
              const localDateString = `${year}-${month}-${day}`; // Always matches your local YYYY-MM-DD

              const resolvedDate = logForm.date === 'Today' 
                ? localDateString 
                : logForm.customDate || localDateString;

              const resolvedLocation = logForm.location === 'Other' ? logForm.customLocation || 'Custom Gym' : logForm.location;

              // 2. Format a new structured historical session entry
              const newSessionRecord = {
              date: resolvedDate,
              location: resolvedLocation,
              sets: validEnteredSets
              };

              // 3. Keep a complete growing timeline array for future stats, while using slice(0, 2) purely for workspace rendering previews
              const existingHistory = Array.isArray(ex.lastSessionStr) ? ex.lastSessionStr : [];
              const updatedHistoryArray = [newSessionRecord, ...existingHistory];

              return {
                ...ex,
                lastSessionStr: updatedHistoryArray,
                // Pass current PR, live sets, AND the newly updated history array into the checker
                pr: calculatePRString(ex.pr, validEnteredSets, updatedHistoryArray)
              };
            }
            return ex;
          })
        };
      }
      return m;
    });

    // Update the master data structure
    const updatedUpper = mapper(muscleData.upper);
    const updatedLower = mapper(muscleData.lower);

    setMuscleData({
      upper: updatedUpper,
      lower: updatedLower
    });

    // Mirror updates to the active view state so statistics change in real-time
    const combinedUpdated = [...updatedUpper, ...updatedLower];
    setCurrentActiveMuscleGroups(
      currentActiveMuscleGroups.map(currentGroup => 
        combinedUpdated.find(g => g.id === currentGroup.id) || currentGroup
      )
    );

    // Save individual exercise complete metrics
    setCompletedExerciseIds([...completedExerciseIds, activeExerciseWorkspace.exercise.id]);
    setSessionTodaySummary([...sessionTodaySummary, workoutSummaryLine]);
    
    setCurrentScreen('ACTIVE_SESSION');
  };

  // --- ACTION: ADD CUSTOM WORKOUT SUBMIT ---
  // --- ACTION: ADD CUSTOM WORKOUT SUBMIT ---
  const handleSaveCustomWorkout = () => {
    if (!customExerciseForm.name.trim()) return;

    const targetId = customExerciseForm.targetMuscleId;

    // 1. Permanently update master lists by just appending a clean, empty exercise object
    const updater = (list) => list.map(m => {
      if (m.id === targetId) {
        return { 
          ...m, 
          exercises: [
            ...m.exercises, 
            {
              id: `custom_${Date.now()}`,
              name: customExerciseForm.name,
              lastSessionStr: [], // Fresh custom exercises start with empty history arrays
              pr: 'None'
            }
          ] 
        };
      }
      return m;
    });

    const updatedUpper = updater(muscleData.upper);
    const updatedLower = updater(muscleData.lower);

    setMuscleData({ upper: updatedUpper, lower: updatedLower });

    // 2. Combine the fully updated master list data
    const combinedData = [...updatedUpper, ...updatedLower];

    // 3. Remap the active muscle groups to use the freshly updated objects from master data
    const matchInActive = currentActiveMuscleGroups.find(g => g.id === targetId);
    
    let nextActiveGroups = currentActiveMuscleGroups.map(currentGroup => {
      return combinedData.find(g => g.id === currentGroup.id) || currentGroup;
    });

    if (!matchInActive) {
      // Pull the new group into today's session if it wasn't already there (e.g. adding Abs on Push day)
      const fullGroupDetails = combinedData.find(g => g.id === targetId);
      if (fullGroupDetails) {
        nextActiveGroups.push(fullGroupDetails);
      }
    }
    setCurrentActiveMuscleGroups(nextActiveGroups);

    // 4. Reset form entries and route back safely
    setCustomExerciseForm({ name: '', targetMuscleId: 'chest' });
    setCurrentScreen('ACTIVE_SESSION');
  };

  const renderMuscleGroupRows = (groups) => {
    return groups.map((group) => {
      const isExpanded = expandedMuscleId === group.id;
      return (
        <div key={group.id} style={{ marginBottom: '8px' }}>
          <div 
            onClick={() => handleMuscleClick(group.id)}
            style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', alignItems: 'center', padding: '10px 8px', borderRadius: '8px', background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', cursor: 'pointer', border: isExpanded ? '1px solid #3b82f6' : '1px solid transparent' }}
          >
            <span style={{ fontWeight: '600', fontSize: '14px', color: '#1f2937' }}>{group.name}</span>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <span style={{ background: getFrequencyColor(group.frequency), width: '44px', textAlign: 'center', borderRadius: '12px', fontSize: '13px', fontWeight: 'bold', padding: '3px 0' }}>{group.frequency}x</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <span style={{ background: getVolumeColor(group.volume), width: '44px', textAlign: 'center', borderRadius: '12px', fontSize: '13px', fontWeight: 'bold', padding: '3px 0' }}>{group.volume}</span>
            </div>
          </div>

          {isExpanded && (
            <div style={{ background: '#f3f4f6', padding: '12px', borderRadius: '0 0 8px 8px', marginTop: '-4px', borderTop: '1px solid #e5e7eb', fontSize: '13px' }}>
              {group.frequency > 0 ? (
                <div>
                  <div style={{ fontWeight: 'bold', color: '#4b5563', marginBottom: '4px' }}>Sets Done This Week:</div>
                  {group.weeklySets.map((set, i) => <div key={i} style={{ padding: '2px 0', color: '#1f2937' }}>• {set}</div>)}
                </div>
              ) : (
                <div>
                  <div style={{ fontWeight: 'bold', color: '#991b1b', marginBottom: '4px' }}>Last Session History:</div>
                  {group.lastSession.length > 0 ? (
                    group.lastSession.map((set, i) => <div key={i} style={{ padding: '2px 0', color: '#1f2937' }}>• {set}</div>)
                  ) : (
                    <div style={{ color: '#9ca3af' }}>No previous history found for this group.</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div style={{ maxWidth: '100%', margin: '20px auto', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', background: '#f9fafb', minHeight: '85vh', border: '1px solid #e5e7eb', borderRadius: '16px', padding: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', position: 'relative' }}>
      
      {/* --- SCREEN A: MAIN DASHBOARD --- */}
      {currentScreen === 'DASHBOARD' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#111827', margin: 0 }}>This Week</h1>
            <button onClick={handleSundayReset} style={{ fontSize: '12px', background: '#ef4444', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>
              Reset to Sunday
            </button>
            <button 
              onClick={() => setCurrentScreen('STATS_DASHBOARD')} 
              style={{ fontSize: '12px', background: '#3b82f6', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
            >
              View All Stats
            </button>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', fontWeight: '700', paddingBottom: '6px', fontSize: '14px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <div>Upper Body</div>
              <div style={{ textAlign: 'center' }}>Freq</div>
              <div style={{ textAlign: 'center' }}>Sets</div>
            </div>
            {renderMuscleGroupRows(muscleData.upper)}
          </div>

          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', fontWeight: '700', paddingBottom: '6px', fontSize: '14px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <div>Lower Body</div>
              <div style={{ textAlign: 'center' }}>Freq</div>
              <div style={{ textAlign: 'center' }}>Sets</div>
            </div>
            {renderMuscleGroupRows(muscleData.lower)}
          </div>

          <div style={{ marginTop: '24px', padding: '10px', background: '#f3f4f6', borderRadius: '8px', fontSize: '11px', color: '#6b7280', textAlign: 'center', lineHeight: '1.4', marginBottom: '60px' }}>
            <strong>Disclaimer:</strong> This is NOT a sliding 7-day window. Data sets unconditionally reset to 0 every Sunday.
          </div>

          <button onClick={() => setCurrentScreen('LOG_WORKOUT')} style={{ position: 'absolute', bottom: '20px', right: '20px', width: '56px', height: '56px', borderRadius: '50%', background: '#2563eb', color: '#ffffff', border: 'none', fontSize: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)', cursor: 'pointer' }}>
            +
          </button>
        </>
      )}

      {/* --- SCREEN B: LOG WORKOUT SPECIFICATION --- */}
      {currentScreen === 'LOG_WORKOUT' && (
        <>
          <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#111827', textAlign: 'center', marginBottom: '24px', marginTop: 0 }}>Log Workout</h2>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontWeight: '700', fontSize: '14px', color: '#4b5563', marginBottom: '8px' }}>Date</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setLogForm({ ...logForm, date: 'Today' })} style={{ flex: 1, padding: '10px', borderRadius: '8px', fontWeight: '600', border: '1px solid #d1d5db', cursor: 'pointer', background: logForm.date === 'Today' ? '#4b5563' : '#ffffff', color: logForm.date === 'Today' ? '#ffffff' : '#1f2937' }}>Today</button>
              <button onClick={() => setLogForm({ ...logForm, date: 'Other' })} style={{ flex: 1, padding: '10px', borderRadius: '8px', fontWeight: '600', border: '1px solid #d1d5db', cursor: 'pointer', background: logForm.date === 'Other' ? '#4b5563' : '#ffffff', color: logForm.date === 'Other' ? '#ffffff' : '#1f2937' }}>Other</button>
            </div>
          </div>

          {logForm.date === 'Other' && (
            <input 
              type="date"
              value={logForm.customDate}
              onChange={(e) => setLogForm({ ...logForm, customDate: e.target.value })}
              style={{ width: '100%', boxSizing: 'border-box', marginTop: '8px', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' }}
            />
          )}

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontWeight: '700', fontSize: '14px', color: '#4b5563', marginBottom: '8px' }}>Location</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setLogForm({ ...logForm, location: 'Planet Fitness' })} style={{ flex: 1, padding: '10px', borderRadius: '8px', fontWeight: '600', border: '1px solid #d1d5db', cursor: 'pointer', background: logForm.location === 'Planet Fitness' ? '#4b5563' : '#ffffff', color: logForm.location === 'Planet Fitness' ? '#ffffff' : '#1f2937' }}>Planet Fitness</button>
              <button onClick={() => setLogForm({ ...logForm, location: 'Other' })} style={{ flex: 1, padding: '10px', borderRadius: '8px', fontWeight: '600', border: '1px solid #d1d5db', cursor: 'pointer', background: logForm.location === 'Other' ? '#4b5563' : '#ffffff', color: logForm.location === 'Other' ? '#ffffff' : '#1f2937' }}>Other</button>
            </div>

            {logForm.location === 'Other' && (
              <input 
                type="text"
                placeholder="Enter custom location name..."
                value={logForm.customLocation}
                onChange={(e) => setLogForm({ ...logForm, customLocation: e.target.value })}
                style={{ width: '100%', boxSizing: 'border-box', marginTop: '8px', padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' }}
              />
            )}
          </div>

          <div style={{ marginBottom: '32px' }}>
            <label style={{ display: 'block', fontWeight: '700', fontSize: '14px', color: '#4b5563', marginBottom: '8px' }}>Type</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {['Upper', 'Legs', 'Push', 'Pull', 'Run', 'Pilates'].map((t) => (
                <button key={t} onClick={() => setLogForm({ ...logForm, type: t })} style={{ padding: '10px', borderRadius: '8px', fontWeight: '600', border: '1px solid #d1d5db', cursor: 'pointer', background: logForm.type === t ? '#4b5563' : '#ffffff', color: logForm.type === t ? '#ffffff' : '#1f2937', fontSize: '13px' }}>{t}</button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => setCurrentScreen('DASHBOARD')} style={{ flex: 1, padding: '12px', borderRadius: '8px', background: '#e2e8f0', color: '#475569', border: 'none', fontWeight: '700', cursor: 'pointer' }}>Back</button>
            <button onClick={handleLogWorkoutNext} style={{ flex: 1, padding: '12px', borderRadius: '8px', background: '#2563eb', color: '#ffffff', border: 'none', fontWeight: '700', cursor: 'pointer' }}>Next</button>
          </div>
        </>
      )}

      {/* --- SCREEN C: ACTIVE SESSION --- */}
      {currentScreen === 'ACTIVE_SESSION' && (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '80vh', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '800', margin: '0 0 2px 0', color: '#111827' }}>Your {logForm.type} Day</h2>
            <p style={{ color: '#6b7280', fontSize: '12px', margin: '0 0 16px 0', lineHeight: '1.5' }}>
              Date: {logForm.date === 'Today' ? new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : logForm.customDate || 'Not Selected'} <br />
              Location: {logForm.location === 'Other' ? logForm.customLocation || 'Custom Gym' : logForm.location}
            </p>
            
            {currentActiveMuscleGroups.map((group) => (
              <div key={group.id} style={{ background: '#fce7f3', padding: '12px', borderRadius: '12px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontWeight: '700', fontSize: '14px', color: '#111827' }}>
                  <span>{group.name}</span>
                  <span>{group.frequency}x | Vol: {group.volume}</span>
                </div>

                {group.exercises && group.exercises.length > 0 ? (
                  group.exercises.map((ex) => {
                    const isExerciseCompleted = completedExerciseIds.includes(ex.id);
                    return (
                      <div key={ex.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: isExerciseCompleted ? '#cbd5e1' : '#ffffff', padding: '8px', borderRadius: '8px', marginBottom: '6px', opacity: isExerciseCompleted ? 0.6 : 1, transition: 'all 0.2s' }}>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: '600', textDecoration: isExerciseCompleted ? 'line-through' : 'none' }}>{ex.name}</div>
                          <div style={{ fontSize: '11px', color: '#6b7280' }}>
                            Last: {Array.isArray(ex.lastSessionStr) && ex.lastSessionStr.length > 0 ? (
                              `${ex.lastSessionStr[0].date || ''}: ${Array.isArray(ex.lastSessionStr[0].sets) ? ex.lastSessionStr[0].sets.join(', ') : ''}`
                            ) : 'None'}
                          </div>
                        </div>
                        <button 
                          onClick={() => handleInitLogExercise(group, ex)}
                          disabled={isExerciseCompleted}
                          style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', fontWeight: '700', cursor: isExerciseCompleted ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          +
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ fontSize: '12px', color: '#6b7280', fontStyle: 'italic', padding: '4px' }}>No recorded default exercises</div>
                )}
              </div>
            ))}

            <button 
              onClick={() => setCurrentScreen('ADD_WORKOUT')} 
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '2px dashed #3b82f6', background: 'transparent', fontWeight: '700', color: '#3b82f6', cursor: 'pointer', fontSize: '14px', marginBottom: '16px' }}
            >
              + Add Other Workout
            </button>

            {sessionTodaySummary.length > 0 && (
              <div style={{ background: '#ffffff', padding: '12px', borderRadius: '12px', border: '1px solid #e5e7eb', marginTop: '12px' }}>
                <div style={{ fontWeight: '700', fontSize: '13px', color: '#374151', marginBottom: '6px' }}>Today</div>
                {sessionTodaySummary.map((item, i) => (
                  <div key={i} style={{ fontSize: '12px', color: '#4b5563', padding: '1px 0' }}>• {item}</div>
                ))}
              </div>
            )}
          </div>

          <button onClick={() => { setCurrentScreen('DASHBOARD'); setSessionTodaySummary([]); setCompletedExerciseIds([]); }} style={{ width: '100%', padding: '12px', borderRadius: '8px', background: '#4b5563', color: '#ffffff', border: 'none', fontWeight: '700', cursor: 'pointer', marginTop: '16px' }}>
            Done
          </button>
        </div>
      )}

      {/* --- SCREEN D: LOG EXERCISE WORKSPACE --- */}
      {currentScreen === 'LOG_EXERCISE' && activeExerciseWorkspace && activeExerciseWorkspace.exercise && (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '80vh', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '800', textAlign: 'center', margin: '0 0 4px 0' }}>{activeExerciseWorkspace.exercise.name}</h2>
            <p style={{ fontSize: '12px', color: '#6b7280', textAlign: 'center', marginBottom: '20px' }}>Input reps like "70x5" or "185x5"</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              {workspaceSets.map((val, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontWeight: '700', fontSize: '13px', minWidth: '45px' }}>Set {idx + 1}</span>
                  <input 
                    type="text" 
                    placeholder="weightxreps" 
                    value={val} 
                    onChange={(e) => {
                      const updated = [...workspaceSets];
                      updated[idx] = e.target.value;
                      setWorkspaceSets(updated);
                    }}
                    style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' }}
                  />
                </div>
              ))}
            </div>

            <button 
              onClick={() => setWorkspaceSets([...workspaceSets, ''])}
              style={{ padding: '8px 14px', borderRadius: '8px', background: '#e2e8f0', color: '#475569', border: 'none', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}
            >
              Add Set
            </button>

            <div style={{ background: '#f3f4f6', padding: '12px', borderRadius: '8px', fontSize: '12px', marginTop: '24px', color: '#4b5563' }}>
              <div><strong>Last PR:</strong> {activeExerciseWorkspace.exercise.pr}</div>
              <div style={{ marginTop: '6px' }}>
                <strong>History (Last 2 Sessions):</strong>
                {Array.isArray(activeExerciseWorkspace.exercise.lastSessionStr) ? (
                  activeExerciseWorkspace.exercise.lastSessionStr.length > 0 ? (
                    activeExerciseWorkspace.exercise.lastSessionStr.slice(0, 2).map((session, i) => {
                      const displaySets = Array.isArray(session.sets) ? session.sets.join(', ') : session;
                      return (
                        <div key={i} style={{ marginTop: '4px', paddingLeft: '4px', color: '#1f2937' }}>
                          <strong>{session.date || 'Past Session'}</strong> : {displaySets}
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ color: '#9ca3af', fontStyle: 'italic', marginTop: '2px' }}>None</div>
                  )
                ) : (
                  <div style={{ color: '#9ca3af', fontStyle: 'italic', marginTop: '2px' }}>None</div>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
            <button onClick={() => setCurrentScreen('ACTIVE_SESSION')} style={{ flex: 1, padding: '12px', borderRadius: '8px', background: '#e2e8f0', color: '#475569', border: 'none', fontWeight: '700', cursor: 'pointer' }}>Back</button>
            <button onClick={handleSaveExerciseLogs} style={{ flex: 1, padding: '12px', borderRadius: '8px', background: '#2563eb', color: '#ffffff', border: 'none', fontWeight: '700', cursor: 'pointer' }}>Next</button>
          </div>
        </div>
      )}

      {/* --- SCREEN E: ADD NEW WORKOUT --- */}
      {currentScreen === 'ADD_WORKOUT' && (
        <>
          <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#111827', textAlign: 'center', marginBottom: '24px', marginTop: 0 }}>Add New Workout</h2>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontWeight: '700', fontSize: '14px', color: '#4b5563', marginBottom: '8px' }}>Name</label>
            <input 
              type="text" 
              value={customExerciseForm.name}
              onChange={(e) => setCustomExerciseForm({ ...customExerciseForm, name: e.target.value })}
              style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px' }}
            />
          </div>

          <div style={{ marginBottom: '32px' }}>
            <label style={{ display: 'block', fontWeight: '700', fontSize: '14px', color: '#4b5563', marginBottom: '8px' }}>What muscle group does this target?</label>
            <select 
              value={customExerciseForm.targetMuscleId}
              onChange={(e) => setCustomExerciseForm({ ...customExerciseForm, targetMuscleId: e.target.value })}
              style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#ffffff', fontSize: '14px' }}
            >
              {[...muscleData.upper, ...muscleData.lower].map(group => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => setCurrentScreen('ACTIVE_SESSION')} style={{ flex: 1, padding: '12px', borderRadius: '8px', background: '#e2e8f0', color: '#475569', border: 'none', fontWeight: '700', cursor: 'pointer' }}>Back</button>
            <button onClick={handleSaveCustomWorkout} style={{ flex: 1, padding: '12px', borderRadius: '8px', background: '#2563eb', color: '#ffffff', border: 'none', fontWeight: '700', cursor: 'pointer' }}>Next</button>
          </div>
        </>
      )}
      {/* --- SCREEN F: STATS DASHBOARD --- */}
      {currentScreen === 'STATS_DASHBOARD' && (
        <>
          {/* Header Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#111827', margin: 0 }}>Stats</h1>
            <button 
              onClick={() => { setCurrentScreen('DASHBOARD'); setExpandedMuscleId(null); }} 
              style={{ fontSize: '12px', background: '#3b82f6', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
            >
              ← Main Dashboard
            </button>
          </div>

          {/* 1. Timeframe Filter Buttons */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '16px' }}>
            {[
              { id: 'ALL', label: 'All Time' },
              { id: '30', label: '30 Days' },
              { id: '90', label: '90 Days' }
            ].map((btn) => (
              <button
                key={btn.id}
                onClick={() => setTimeframe(btn.id)}
                style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  padding: '6px 14px',
                  borderRadius: '20px',
                  cursor: 'pointer',
                  border: 'none',
                  background: timeframe === btn.id ? '#4b5563' : '#e5e7eb',
                  color: timeframe === btn.id ? '#ffffff' : '#374151',
                  transition: 'all 0.1s'
                }}
              >
                {btn.label}
              </button>
            ))}
          </div>

          {/* 2. Sub-Screen View Tabs */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '24px' }}>
            {['General', 'Workout'].map((tab) => (
              <button
                key={tab}
                onClick={() => setStatsTab(tab)}
                style={{
                  fontSize: '13px',
                  fontWeight: '700',
                  padding: '6px 18px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  border: 'none',
                  background: statsTab === tab ? '#4b5563' : '#e5e7eb',
                  color: statsTab === tab ? '#ffffff' : '#374151',
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* ==================== WORKOUT VIEW CONTROLLER ==================== */}
          {statsTab === 'Workout' && ['upper', 'lower'].map((regionKey) => (
            <div key={regionKey} style={{ marginBottom: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', fontWeight: '700', paddingBottom: '6px', fontSize: '14px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <div>{regionKey === 'upper' ? 'Upper Body' : 'Lower Body'}</div>
                <div style={{ textAlign: 'center' }}>Freq</div>
                <div style={{ textAlign: 'center' }}>Sets</div>
              </div>

              {muscleData[regionKey].map((group) => {
                const isExpanded = expandedMuscleId === group.id;

                let totalHistoricalSets = 0;
                let uniqueDatesTracked = new Set();
                const now = new Date();

                group.exercises.forEach(ex => {
                  if (Array.isArray(ex.lastSessionStr)) {
                    ex.lastSessionStr.forEach(session => {
                      if (!session.date) return;
                      if (timeframe !== 'ALL') {
                        const sessionDate = new Date(session.date);
                        const daysDifference = (now - sessionDate) / (1000 * 60 * 60 * 24);
                        if (timeframe === '30' && daysDifference > 30) return;
                        if (timeframe === '90' && daysDifference > 90) return;
                      }
                      uniqueDatesTracked.add(session.date);
                      if (Array.isArray(session.sets)) totalHistoricalSets += session.sets.length;
                    });
                  }
                });

                const totalHistoricalFrequency = uniqueDatesTracked.size;

                return (
                  <div key={group.id} style={{ marginBottom: '8px' }}>
                    <div 
                      onClick={() => setExpandedMuscleId(isExpanded ? null : group.id)}
                      style={{ 
                        display: 'grid', 
                        gridTemplateColumns: '2fr 1fr 1fr', 
                        alignItems: 'center', 
                        padding: '10px 8px', 
                        borderRadius: '8px', 
                        background: '#ffffff', 
                        boxShadow: '0 1px 3px rgba(0,0,0,0.06)', 
                        cursor: 'pointer', 
                        border: isExpanded ? '1px solid #3b82f6' : '1px solid transparent' 
                      }}
                    >
                      <span style={{ fontWeight: '600', fontSize: '14px', color: '#1f2937' }}>{group.name}</span>
                      <div style={{ textAlign: 'center' }}>
                        <span style={{ background: '#f3f4f6', width: '44px', textAlign: 'center', borderRadius: '12px', fontSize: '13px', fontWeight: 'bold', padding: '3px 0', display: 'inline-block' }}>{totalHistoricalFrequency}x</span>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <span style={{ background: '#f3f4f6', width: '44px', textAlign: 'center', borderRadius: '12px', fontSize: '13px', fontWeight: 'bold', padding: '3px 0', display: 'inline-block' }}>{totalHistoricalSets}</span>
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{ background: '#f3f4f6', padding: '12px', borderRadius: '0 0 8px 8px', marginTop: '-4px', borderTop: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {group.exercises.map((ex) => (
                          <div key={ex.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f43f5e', color: 'white', padding: '10px 14px', borderRadius: '20px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{ex.name}</span>
                              <span style={{ fontSize: '11px', opacity: 0.9 }}>PR: {ex.pr || 'None'}</span>
                            </div>
                            <button 
                              onClick={() => { setSelectedStatsExercise(ex); setCurrentScreen('EXERCISE_HISTORY_NOTES'); }}
                              style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}
                            >
                              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                            </button>
                          </div>
                        ))}
                        {group.exercises.length === 0 && <div style={{ fontSize: '12px', color: '#6b7280', fontStyle: 'italic', textAlign: 'center', padding: '4px' }}>No movements added here yet.</div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {/* ==================== GENERAL VIEW CONTROLLER ==================== */}
          {statsTab === 'General' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', padding: '0 8px' }}>
              
              {/* Data Engine Block - Calculates everything cleanly from your state logs */}
              {(() => {
                const now = new Date();
                
                // Track unique gym dates globally to avoid counting overlapping muscle sets on the same day twice
                let uniqueGymDates = new Set();
                
                // Track counts for the charts
                let typeCounts = { Upper: 0, Lower: 0, Push: 0, Pull: 0, Other: 0 };
                let monthCounts = { Jan: 0, Feb: 0, Mar: 0, Apr: 0, May: 0, Jun: 0, Jul: 0, Aug: 0, Sep: 0, Oct: 0, Nov: 0, Dec: 0 };
                const monthKeys = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

                // Process every tracked session in muscleData across all regions
                Object.keys(muscleData).forEach(region => {
                  muscleData[region].forEach(group => {
                    group.exercises.forEach(ex => {
                      if (Array.isArray(ex.lastSessionStr)) {
                        ex.lastSessionStr.forEach(session => {
                          if (!session.date) return;
                          
                          // Apply Timeframe Window Filters (30 Days / 90 Days / All)
                          const sDate = new Date(session.date);
                          if (timeframe !== 'ALL') {
                            const diffDays = (now - sDate) / (1000 * 60 * 60 * 24);
                            if (timeframe === '30' && diffDays > 30) return;
                            if (timeframe === '90' && diffDays > 90) return;
                          }

                          // Unique date identifier key to aggregate session distributions
                          const dateStr = session.date; // "YYYY-MM-DD"
                          const monthIndex = parseInt(dateStr.split('-')[1], 10) - 1;
                          const monthName = monthKeys[monthIndex];

                          if (!uniqueGymDates.has(dateStr)) {
                            uniqueGymDates.add(dateStr);
                            
                            // Categorize day type based on targeted muscle groups
                            const nameLower = group.name.toLowerCase();
                            if (nameLower.includes('chest') || nameLower.includes('shoulders') || nameLower.includes('triceps')) {
                              typeCounts.Push++;
                            } else if (nameLower.includes('lats') || nameLower.includes('upper back') || nameLower.includes('biceps') || nameLower.includes('rear delts')) {
                              typeCounts.Pull++;
                            } else if (nameLower.includes('quads') || nameLower.includes('hamstrings') || nameLower.includes('calves') || nameLower.includes('glutes')) {
                              typeCounts.Lower++;
                            } else if (region === 'upper') {
                              typeCounts.Upper++;
                            } else {
                              typeCounts.Other++;
                            }

                            // Accumulate month buckets
                            if (monthName) {
                              monthCounts[monthName]++;
                            }
                          }
                        });
                      }
                    });
                  });
                });

                const totalTimesGone = uniqueGymDates.size;

                // Calculate CSS Conic Gradient Angles for Pie Chart Slices
                const pieTotal = typeCounts.Upper + typeCounts.Lower + typeCounts.Push + typeCounts.Pull + typeCounts.Other;
                let pieGradient = '#e5e7eb 0% 100%'; // Default gray if empty

                if (pieTotal > 0) {
                  const pUpper = (typeCounts.Upper / pieTotal) * 100;
                  const pLower = (typeCounts.Lower / pieTotal) * 100;
                  const pPush = (typeCounts.Push / pieTotal) * 100;
                  const pPull = (typeCounts.Pull / pieTotal) * 100;

                  const s1 = pUpper;
                  const s2 = s1 + pLower;
                  const s3 = s2 + pPush;
                  const s4 = s3 + pPull;

                  pieGradient = `
                    #3b82f6 0% ${s1}%, 
                    #ef4444 ${s1}% ${s2}%, 
                    #f59e0b ${s2}% ${s3}%, 
                    #10b981 ${s3}% ${s4}%, 
                    #f43f5e ${s4}% 100%
                  `;
                }

                // Find highest monthly value to correctly auto-scale bar charts dynamically
                const maxMonthVal = Math.max(...Object.values(monthCounts), 1);

                return (
                  <>
                    {/* Dynamic Overall Attendance Card */}
                    <div style={{ background: '#f3f4f6', padding: '16px', borderRadius: '12px', textAlign: 'center' }}>
                      <span style={{ fontSize: '14px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase' }}>Total Times Gone</span>
                      <h2 style={{ fontSize: '36px', fontWeight: '900', color: '#111827', margin: '4px 0 0 0' }}>{totalTimesGone}</h2>
                    </div>

                    {/* Gym Days by Type Pie Chart Section */}
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#111827', marginBottom: '12px', textAlign: 'center' }}>Gym Days by Type</h3>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px', flexWrap: 'wrap' }}>
                        
                        {/* Dynamic Gradient Pie Wheel */}
                        <div style={{
                          width: '140px',
                          height: '140px',
                          borderRadius: '50%',
                          background: `conic-gradient(${pieGradient})`,
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                          transition: 'background 0.3s ease'
                        }} />
                        
                        {/* Legend Grid Panel */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px', fontWeight: '600' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#3b82f6' }}></div>Upper ({typeCounts.Upper})</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#ef4444' }}></div>Lower ({typeCounts.Lower})</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#f59e0b' }}></div>Push ({typeCounts.Push})</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#10b981' }}></div>Pull ({typeCounts.Pull})</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#f43f5e' }}></div>Other ({typeCounts.Other})</div>
                        </div>
                      </div>
                    </div>

                    {/* Gym Days by Month Bar Chart Section */}
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#111827', marginBottom: '16px', textAlign: 'center' }}>Gym Days by Month</h3>
                      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '140px', padding: '0 10px', borderBottom: '2px solid #e5e7eb', gap: '4px' }}>
                        {monthKeys.map((month) => {
                          const val = monthCounts[month];
                          // Scale bar heights relative to maximum month log count
                          const barHeight = val > 0 ? (val / maxMonthVal) * 110 : 0;

                          return (
                            <div key={month} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: '6px' }}>
                              <div style={{ 
                                width: '100%', 
                                height: `${barHeight}px`, 
                                background: '#3b82f6', 
                                borderRadius: '4px 4px 0 0',
                                position: 'relative',
                                display: 'flex',
                                justifyContent: 'center',
                                minHeight: val > 0 ? '16px' : '0px',
                                transition: 'height 0.3s ease'
                              }}>
                                {val > 0 && (
                                  <span style={{ fontSize: '9px', fontWeight: '800', color: '#ffffff', position: 'absolute', top: '1px' }}>
                                    {val}
                                  </span>
                                )}
                              </div>
                              <span style={{ fontSize: '9px', fontWeight: '700', color: '#6b7280', transform: 'rotate(-45deg)', marginTop: '4px', display: 'inline-block' }}>
                                {month}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ height: '16px' }}></div>
                    </div>
                  </>
                );
              })()}

            </div>
          )}
        </>
      )}

      {/* --- SCREEN G: EXERCISE HISTORY NOTES --- */}
      {currentScreen === 'EXERCISE_HISTORY_NOTES' && selectedStatsExercise && (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '78vh', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#000000', marginBottom: '24px', marginTop: '10px', textAlign: 'center' }}>
              {selectedStatsExercise.name} History
            </h1>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingLeft: '8px', maxWidth: '100%' }}>
            {Array.isArray(selectedStatsExercise.lastSessionStr) && selectedStatsExercise.lastSessionStr.length > 0 ? (
            [...selectedStatsExercise.lastSessionStr]
              .sort((a, b) => {
                // Sorts YYYY-MM-DD strings descending (most recent first)
                if (!a.date) return 1;
                if (!b.date) return -1;
                return b.date.localeCompare(a.date);
              })
              .map((session, index) => {
                  // Reformat stored continuous string dates 'YYYY-MM-DD' down to clean 'M/D' notes display
                  const rawDateParts = session.date ? session.date.split('-') : [];
                  const displayShortDate = rawDateParts.length === 3 ? `${parseInt(rawDateParts[1])}/${parseInt(rawDateParts[2])}` : 'Log Entry';

                  return (
                    <div key={index} style={{ borderLeft: '2px solid #e5e7eb', paddingLeft: '12px' }}>
                      <div style={{ fontWeight: '800', fontSize: '16px', color: '#000000', marginBottom: '4px' }}>
                        {displayShortDate}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {Array.isArray(session.sets) ? (
                          session.sets.map((set, setIdx) => (
                            <div key={setIdx} style={{ fontSize: '14px', color: '#374151', fontFamily: 'monospace' }}>
                              {set}
                            </div>
                          ))
                        ) : (
                          <div style={{ fontSize: '14px', color: '#374151' }}>{session}</div>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ color: '#9ca3af', fontStyle: 'italic', textAlign: 'center', marginTop: '40px' }}>
                  No full notebook logs found for this movement yet.
                </div>
              )}
            </div>
          </div>

          <button 
            onClick={() => { setCurrentScreen('STATS_DASHBOARD'); }} 
            style={{ alignSelf: 'flex-start', background: '#6b7280', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '12px', fontSize: '15px', fontWeight: '700', cursor: 'pointer', marginTop: '30px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
          >
            Back
          </button>
        </div>
      )}

                

    </div>
  );
}