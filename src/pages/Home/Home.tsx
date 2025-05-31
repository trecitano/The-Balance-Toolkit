import "./Home.css";

function Home() {
  return (
    <div className="home-page">
      <div className="banner">
        <h1>Welcome to the Home Page!</h1>
      </div>
      <div className="container-row">
        <div className="container">Devices</div>
        <div className="container">Participant</div>
        <div className="container">Session</div>
      </div>
    </div>
  );
}

export default Home;