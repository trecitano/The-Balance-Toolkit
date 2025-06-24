import './Activities.css';
import ActivityCard from './ActivityCard';

import activitiesIcon from '../../assets/activities-icon.svg';
import lightIcon from '../../assets/light-icon.svg';
import bookIcon from '../../assets/book-icon.svg';
import bookmarkIcon from '../../assets/book-bookmark-icon.svg';
import wbbIcon from '../../assets/wbb-icon-line.svg';
import logoIcon from '../../assets/balance-icon.svg';
import homeIcon from '../../assets/home-icon.svg';
import fileIcon from '../../assets/file-icon.svg';
import settingsIcon from '../../assets/settings-icon.svg';
import sessionIcon from '../../assets/session-icon.svg';

export interface ActivityData {
  id: number;
  title: string;
  staticImage: string;
  hoverImages: string[];
  description: string;
}

export default function Activities() {
  const activitiesData: ActivityData[] = [
    {
      id: 1,
      title: "Quiet standing (eyes-close + eyes-open)",
      staticImage: activitiesIcon,
      hoverImages: [activitiesIcon, lightIcon, activitiesIcon, fileIcon, settingsIcon, wbbIcon],
      description: "Assess stability while standing still with eyes open and closed."
    },
    {
      id: 2,
      title: "Timed Up and Go (TUG)",
      staticImage: bookIcon,
      hoverImages: [bookIcon, bookmarkIcon, bookIcon],
      description: "Measure mobility and balance by timing the 'up and go' sequence."
    },
    {
      id: 3,
      title: "Single leg stance",
      staticImage: wbbIcon,
      hoverImages: [wbbIcon, logoIcon, wbbIcon],
      description: "Evaluate balance by standing on one leg for a period of time."
    },
    {
      id: 4,
      title: "Tandem stance",
      staticImage: homeIcon,
      hoverImages: [homeIcon, lightIcon, homeIcon],
      description: "Test balance by standing with one foot directly in front of the other."
    },
    {
      id: 5,
      title: "Functional Reach Test",
      staticImage: fileIcon,
      hoverImages: [fileIcon, settingsIcon, fileIcon],
      description: "Measure forward reach distance to assess balance and stability limits."
    },
    {
      id: 6,
      title: "Dynamic weight shifting",
      staticImage: activitiesIcon,
      hoverImages: [activitiesIcon, sessionIcon, activitiesIcon],
      description: "Assess the ability to shift weight effectively while maintaining balance."
    },
  ];

  return (
    <div className="activities-page">
      <div className="activities-header">
        <span className="page-title">Activities</span>
      </div>
      <div className="activities-content">
        <div className="activities-grid">
          {activitiesData.map((activity) => (
            <ActivityCard key={activity.id} activity={activity} />
          ))}
        </div>
      </div>
    </div>
  );
}