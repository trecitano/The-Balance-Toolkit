use crate::file_system::ActivitiesFileSystem;
use crate::types::OngoingSessionActivityState;
use anyhow::Result;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Activity {
    pub id: String,
    pub title: String,
    pub static_image: String,
    pub timeline_blocks: Vec<TimelineBlock>,
    pub boards_required: i32,
    pub description: String,
    pub loops: i32,
}

impl Activity {
    pub fn get_total_duration_ms(&self) -> i32 {
        let loop_duration: i32 = self.timeline_blocks.iter().map(|tb| tb.duration).sum();
        loop_duration * self.loops * 1000
    }

    /// Zero-based loop/block position; no ongoing state for an invalid or finished activity.
    pub fn state_at(&self, elapsed: chrono::TimeDelta) -> Option<OngoingSessionActivityState> {
        if self.loops <= 0 || self.timeline_blocks.iter().any(|block| block.duration < 0) {
            return None;
        }
        let loop_ms: i64 = self
            .timeline_blocks
            .iter()
            .map(|block| i64::from(block.duration) * 1000)
            .sum();
        let elapsed_ms = elapsed.num_milliseconds().max(0);
        if loop_ms == 0 || elapsed_ms >= loop_ms * i64::from(self.loops) {
            return None;
        }

        let mut remaining_ms = elapsed_ms % loop_ms;
        for (index, block) in self.timeline_blocks.iter().enumerate() {
            let block_ms = i64::from(block.duration) * 1000;
            if remaining_ms < block_ms {
                return Some(OngoingSessionActivityState {
                    current_block_index: index as i32,
                    time_to_next_block_ms: (block_ms - remaining_ms).min(i64::from(i32::MAX))
                        as i32,
                    loop_number: (elapsed_ms / loop_ms) as i32,
                });
            }
            remaining_ms -= block_ms;
        }
        None
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TimelineBlock {
    pub title: String,
    pub id: String,
    pub duration: i32,
}

pub struct ActivityState {
    activities: Vec<Activity>,
}

impl ActivityState {
    pub fn new() -> Result<Self> {
        let activities = ActivitiesFileSystem::get_or_create_default_activities()?;

        Ok(Self { activities })
    }

    pub fn get_copy_of_activities(&self) -> Vec<Activity> {
        self.activities.clone()
    }

    pub fn get_copy_of_activity(&self, id: &str) -> Option<Activity> {
        self.activities.iter().find(|a| a.id == id).cloned()
    }

    pub fn update_activity(&mut self, activity: Activity) -> Result<()> {
        log::debug!("Updating activity: {:?}", activity);
        let index = self
            .activities
            .iter()
            .position(|a| a.id == activity.id)
            .unwrap();
        self.activities[index] = activity;
        ActivitiesFileSystem::save_activities(&self.activities)?;
        Ok(())
    }

    pub fn reset_activity(&mut self, id: &str) -> Result<Activity> {
        let default_activities = Self::create_default_activities();
        let default_activity = default_activities.into_iter().find(|a| a.id == id).unwrap();
        let index = self.activities.iter().position(|a| a.id == id).unwrap();
        self.activities[index] = default_activity.clone();
        Ok(default_activity)
    }

    pub fn get_available_time_blocks(&self) -> Vec<TimelineBlock> {
        TIMELINE_BLOCKS.iter().map(|(id, _, _)| block(id)).collect()
    }

    pub fn create_default_activities() -> Vec<Activity> {
        vec![
            // Eyes Open-close
            Activity {
                id: "eyes-open-close".into(),
                title: "Eyes open-close".into(),
                static_image: "eyes-open".into(),
                boards_required: 1,
                description: "Assess balance during quiet standing with eyes open and closed"
                    .into(),
                timeline_blocks: vec![
                    block("step-onto-board"),
                    block("eyes-open"),
                    block("eyes-close"),
                ],
                loops: 2,
            },
            // Functional Reach
            Activity {
                id: "functional-reach-test".into(),
                title: "Functional Reach Test".into(),
                static_image: "left-arm-reach".into(),
                boards_required: 1,
                description: "Measure reaching capability while maintaining balance".into(),
                timeline_blocks: vec![
                    block("step-onto-board"),
                    block("stand-on-the-board-reach"),
                    block("left-arm-up"),
                    block("left-arm-reach"),
                    block("left-arm-down"),
                    block("right-arm-up"),
                    block("right-arm-reach"),
                    block("right-arm-down"),
                ],
                loops: 2,
            },
            // Single Leg Stance
            Activity {
                id: "single-leg-stance".into(),
                title: "Single leg stance".into(),
                static_image: "left-leg-up".into(),
                boards_required: 1,
                description: "Assess balance while standing on one leg".into(),
                timeline_blocks: vec![
                    block("step-onto-board"),
                    block("stand-on-the-board"),
                    block("left-leg-up"),
                    block("stand-on-the-board"),
                    block("right-leg-up"),
                    block("stand-on-the-board"),
                ],
                loops: 2,
            },
            // Tandem Stance
            Activity {
                id: "tandem-stance".into(),
                title: "Tandem stance".into(),
                static_image: "left-foot-in-front".into(),
                boards_required: 1,
                description: "Assess balance with feet in tandem position".into(),
                timeline_blocks: vec![
                    block("step-onto-board"),
                    block("stand-on-the-board"),
                    block("left-foot-in-front"),
                    block("stand-on-the-board"),
                    block("right-foot-in-front"),
                    block("stand-on-the-board"),
                ],
                loops: 2,
            },
            // TUG
            Activity {
                id: "tug".into(),
                title: "Timed Up and Go (TUG)".into(),
                static_image: "turn-around".into(),
                boards_required: 1,
                description: "Evaluate mobility and fall risk".into(),
                timeline_blocks: vec![
                    block("sit"),
                    block("stand"),
                    block("walk-forward"),
                    block("turn-around"),
                    block("walk-back"),
                    block("sit-again"),
                ],
                loops: 2,
            },
            // Squat
            Activity {
                id: "squat-two-boards".into(),
                title: "Squat".into(),
                static_image: "dual-board-squat-on-the-boards".into(),
                boards_required: 2,
                description: "Assess controlled weight shifting ability".into(),
                timeline_blocks: vec![
                    block("dual-board-step-on-the-boards"),
                    block("dual-board-one-foot-on-each-board"),
                    block("dual-board-squat-on-the-boards"),
                    block("dual-board-stand-on-the-boards"),
                ],
                loops: 2,
            },
        ]
    }
}

/// Every timeline block a user can put in an activity: `(id, title, duration in seconds)`.
/// The id doubles as the name of the illustration the frontends show.
const TIMELINE_BLOCKS: &[(&str, &str, i32)] = &[
    ("eyes-close", "Eyes Closed", 4),
    ("eyes-open", "Eyes Open", 4),
    ("lean-backwards", "Lean Backwards", 6),
    ("lean-forward", "Lean Forward", 6),
    ("lean-to-the-left", "Lean to the Left", 6),
    ("lean-to-the-right", "Lean to the Right", 8),
    ("left-arm-down", "Left Arm Down", 8),
    ("left-arm-reach", "Left Arm Reach", 8),
    ("left-arm-up", "Left Arm Up", 8),
    ("left-foot-in-front", "Left Foot in Front", 8),
    ("left-leg-up", "Left Leg Up", 8),
    ("right-arm-down", "Right Arm Down", 8),
    ("right-arm-reach", "Right Arm Reach", 8),
    ("right-arm-up", "Right Arm Up", 8),
    ("right-foot-in-front", "Right Foot in Front", 8),
    ("right-leg-up", "Right Leg Up", 8),
    ("sit", "Sit", 12),
    ("sit-again", "Sit Again", 12),
    ("stand", "Stand", 12),
    ("stand-on-the-board", "Stand on the Board", 12),
    ("stand-on-the-board-reach", "Stand on the Board (Reach)", 12),
    ("stand-upright", "Stand Upright", 12),
    ("step-onto-board", "Step onto Board", 12),
    ("tare", "Tare", 12),
    ("turn-around", "Turn Around", 12),
    ("walk-back", "Walk Back", 12),
    ("walk-forward", "Walk Forward", 12),
    ("dual-board-tare", "Tare", 3),
    ("dual-board-step-on-the-boards", "Step on the boards", 3),
    (
        "dual-board-one-foot-on-each-board",
        "One foot on each board",
        3,
    ),
    ("dual-board-squat-on-the-boards", "Squat on the boards", 3),
    ("dual-board-stand-on-the-boards", "Stand on the boards", 3),
];

/// Builds the block with the given id. Panics on an unknown id, which can only be a typo
/// in the default activities below.
fn block(id: &str) -> TimelineBlock {
    let (id, title, duration) = TIMELINE_BLOCKS
        .iter()
        .find(|(block_id, _, _)| *block_id == id)
        .unwrap_or_else(|| panic!("unknown timeline block id: {id}"));
    TimelineBlock {
        title: (*title).to_string(),
        id: (*id).to_string(),
        duration: *duration,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeDelta;

    fn activity(durations: &[i32], loops: i32) -> Activity {
        Activity {
            id: "test".into(),
            title: String::new(),
            static_image: String::new(),
            description: String::new(),
            boards_required: 1,
            loops,
            timeline_blocks: durations
                .iter()
                .map(|&duration| TimelineBlock {
                    id: String::new(),
                    title: String::new(),
                    duration,
                })
                .collect(),
        }
    }

    #[test]
    fn timeline_advances_across_blocks_and_loops_then_finishes() {
        let activity = activity(&[2, 3], 2);
        for (elapsed_ms, expected) in [
            (-1, (0, 0, 2000)),
            (0, (0, 0, 2000)),
            (1999, (0, 0, 1)),
            (2000, (0, 1, 3000)),
            (4999, (0, 1, 1)),
            (5000, (1, 0, 2000)),
            (7000, (1, 1, 3000)),
            (9999, (1, 1, 1)),
        ] {
            let state = activity
                .state_at(TimeDelta::milliseconds(elapsed_ms))
                .unwrap();
            assert_eq!(
                (
                    state.loop_number,
                    state.current_block_index,
                    state.time_to_next_block_ms
                ),
                expected
            );
        }
        assert!(activity.state_at(TimeDelta::milliseconds(10_000)).is_none());
        assert!(activity.state_at(TimeDelta::milliseconds(10_001)).is_none());
    }

    #[test]
    fn empty_or_invalid_timelines_have_no_ongoing_state() {
        for activity in [
            activity(&[], 2),
            activity(&[0, 0], 2),
            activity(&[2], 0),
            activity(&[2], -1),
            activity(&[2, -1], 2),
        ] {
            assert!(activity.state_at(TimeDelta::zero()).is_none());
        }
        let state = activity(&[0, 2, 0], 2)
            .state_at(TimeDelta::seconds(2))
            .unwrap();
        assert_eq!(
            (
                state.loop_number,
                state.current_block_index,
                state.time_to_next_block_ms
            ),
            (1, 1, 2000)
        );
    }
}
